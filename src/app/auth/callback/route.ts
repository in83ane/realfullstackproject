import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// Email ที่อนุมัติอัตโนมัติ (ไม่ต้องรอ admin)
const AUTO_APPROVED_EMAILS = ['realrockza@gmail.com']

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    // Create initial response
    const response = NextResponse.redirect(`${origin}/auth/pending`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            const cookie = request.headers.get('cookie')?.match(new RegExp(`${name}=([^;]+)`))?.[1]
            return cookie
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({
              name,
              value,
              httpOnly: true,
              maxAge: options.maxAge,
              path: options.path || '/',
              sameSite: options.sameSite,
              secure: options.secure,
            })
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({
              name,
              value: '',
              httpOnly: true,
              maxAge: 0,
              path: options.path || '/',
            })
          },
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !user) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
    }

    // ตรวจสอบว่าเป็น auto-approved email หรือไม่
    const userEmail = user.email || ''
    const isAutoApproved = AUTO_APPROVED_EMAILS.includes(userEmail)

    // เช็ค profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_approved, role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    const fullName = user.user_metadata?.full_name ||
                     user.user_metadata?.name ||
                     profile?.full_name ||
                     user.email?.split('@')[0] ||
                     'New User'

    const isNewUser = !profile || profile.is_approved === null || profile.is_approved === undefined

    if (isNewUser) {
      // สร้าง profile ใหม่
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          is_approved: isAutoApproved,
          full_name: fullName,
          role: isAutoApproved ? 'admin' : 'user'
        }, { onConflict: 'id' })

      if (upsertError) {
        console.error('Profile upsert error:', upsertError)
      }

      // สร้าง employee record
      const { data: existingEmployee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!existingEmployee) {
        await supabase.from('employees').insert([{
          name: fullName,
          user_id: user.id,
          is_active: false,
          department_id: null,
        }])
      }

      // Redirect based on approval
      if (isAutoApproved) {
        response.headers.set('Location', `${origin}/home`)
      } else {
        response.headers.set('Location', `${origin}/auth/pending?email=${encodeURIComponent(user.email || '')}`)
      }
      return response
    }

    // ถ้ายังไม่ได้รับการอนุมัติ
    if (!profile.is_approved && profile.role !== 'admin' && profile.role !== 'owner') {
      if (isAutoApproved) {
        await supabase.from('profiles').update({ is_approved: true, role: 'admin' }).eq('id', user.id)
        response.headers.set('Location', `${origin}/home`)
      } else {
        response.headers.set('Location', `${origin}/auth/pending?email=${encodeURIComponent(user.email || '')}`)
      }
      return response
    }

    // ผ่านการอนุมัติแล้ว
    response.headers.set('Location', `${origin}/home`)
    return response
  }

  return NextResponse.redirect(`${origin}/auth/login`)
}
