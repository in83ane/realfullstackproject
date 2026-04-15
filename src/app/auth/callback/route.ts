import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// Email ที่อนุมัติอัตโนมัติ (ไม่ต้องรอ admin)
const AUTO_APPROVED_EMAILS = ['realrockza@gmail.com']

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')

  if (code) {
    // Create response for setting cookies
    let response = NextResponse.redirect(`${origin}/home`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.headers.get('cookie')?.match(new RegExp(`${name}=([^;]+)`))?.[1]
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: '', ...options, maxAge: 0 })
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !data.user) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
    }

    try {
      // เช็คว่าเป็น user ใหม่หรือ login ปกติ
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_approved, role, full_name')
        .eq('id', data.user.id)
        .maybeSingle()

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile fetch error:', profileError)
      }

      const fullName = data.user.user_metadata?.full_name ||
                       data.user.user_metadata?.name ||
                       profile?.full_name ||
                       data.user.email?.split('@')[0] ||
                       'New User'

      const userEmail = data.user.email || ''
      const isAutoApproved = AUTO_APPROVED_EMAILS.includes(userEmail)

      const isNewUser = !profile || profile.is_approved === null || profile.is_approved === undefined

      if (isNewUser) {
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: data.user.email,
            is_approved: isAutoApproved,
            full_name: fullName,
            role: isAutoApproved ? 'admin' : 'user'
          }, { onConflict: 'id' })

        if (upsertError) {
          console.error('Profile upsert error:', upsertError)
        }

        const { data: existingEmployee } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', data.user.id)
          .maybeSingle()

        if (!existingEmployee) {
          const { error: empError } = await supabase
            .from('employees')
            .insert([{
              name: fullName,
              user_id: data.user.id,
              is_active: false,
              department_id: null,
            }])

          if (empError) {
            console.error('Employee creation error:', empError)
          }
        }

        // Update redirect URL based on approval
        if (isAutoApproved) {
          response = NextResponse.redirect(`${origin}/home`)
        } else {
          response = NextResponse.redirect(`${origin}/auth/pending?email=${encodeURIComponent(data.user.email || '')}`)
        }
        return response
      }

      if (!profile.is_approved && profile.role !== 'admin' && profile.role !== 'owner') {
        if (isAutoApproved) {
          await supabase
            .from('profiles')
            .update({ is_approved: true, role: 'admin' })
            .eq('id', data.user.id)
          response = NextResponse.redirect(`${origin}/home`)
        } else {
          response = NextResponse.redirect(`${origin}/auth/pending?email=${encodeURIComponent(data.user.email || '')}`)
        }
        return response
      }

      return response
    } catch (err) {
      console.error('Callback processing error:', err)
      return NextResponse.redirect(`${origin}/auth/login?error=server_error`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login`)
}
