import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Email ที่อนุมัติอัตโนมัติ (ไม่ต้องรอ admin)
const AUTO_APPROVED_EMAILS = ['realrockza@gmail.com']

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options, maxAge: 0 })
          },
        },
      }
    )

    const { data: { user, session }, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log('Callback - User:', user?.email)
    console.log('Callback - Session:', session ? 'exists' : 'null')
    console.log('Callback - Error:', error)

    if (error || !user) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
    }

    // Determine redirect URL
    const userEmail = user.email || ''
    const isAutoApproved = AUTO_APPROVED_EMAILS.includes(userEmail)

    let redirectUrl = `${origin}/auth/pending?email=${encodeURIComponent(userEmail)}`

    // Check profile
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
      await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email,
        is_approved: isAutoApproved,
        full_name: fullName,
        role: isAutoApproved ? 'admin' : 'user'
      }, { onConflict: 'id' })

      // Create employee record
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

      if (isAutoApproved) {
        redirectUrl = `${origin}/home`
      }
    } else if (!profile.is_approved && profile.role !== 'admin' && profile.role !== 'owner') {
      if (isAutoApproved) {
        await supabase.from('profiles').update({ is_approved: true, role: 'admin' }).eq('id', user.id)
        redirectUrl = `${origin}/home`
      }
    } else {
      redirectUrl = `${origin}/home`
    }

    console.log('Callback - Redirecting to:', redirectUrl)

    // Important: Create a fresh response after all cookie operations
    const response = NextResponse.redirect(redirectUrl)
    return response
  }

  return NextResponse.redirect(`${origin}/auth/login`)
}
