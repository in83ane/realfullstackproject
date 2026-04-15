import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Email ที่อนุมัติอัตโนมัติ
const AUTO_APPROVED_EMAILS = ['realrockza@gmail.com']

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  // ใช้ domain หลักโดยตรง ไม่ใช่ preview URL
  const origin = 'https://worldwide-one.vercel.app'

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
            try {
              cookieStore.set({ name, value, ...options })
            } catch (e) {
              console.error('Cookie set error:', e)
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options, maxAge: 0 })
            } catch (e) {
              console.error('Cookie remove error:', e)
            }
          },
        },
      }
    )

    const { data: { user, session }, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log('=== CALLBACK DEBUG ===')
    console.log('User:', user?.email)
    console.log('Session:', session ? 'EXISTS' : 'NULL')
    console.log('Error:', error)
    console.log('Origin:', origin)
    console.log('======================')

    if (error || !user) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
    }

    const userEmail = user.email || ''
    const isAutoApproved = AUTO_APPROVED_EMAILS.includes(userEmail)

    // Check and create/update profile
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

    // Always upsert profile
    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      is_approved: isAutoApproved,
      full_name: fullName,
      role: isAutoApproved ? 'owner' : 'user'
    }, { onConflict: 'id' })

    // Create employee if not exists
    const { data: existingEmployee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!existingEmployee) {
      await supabase.from('employees').insert([{
        name: fullName,
        user_id: user.id,
        is_active: isAutoApproved,
        department_id: null,
      }])
    }

    // Determine redirect - prioritize isAutoApproved
    const isApproved = isAutoApproved || profile?.is_approved === true || profile?.role === 'admin' || profile?.role === 'owner'
    const redirectUrl = isApproved ? `${origin}/home` : `${origin}/auth/pending`

    console.log('Redirecting to:', redirectUrl)
    console.log('Is approved:', isApproved)
    console.log('Is auto approved:', isAutoApproved)
    console.log('Profile role:', profile?.role)

    return NextResponse.redirect(redirectUrl)
  }

  return NextResponse.redirect(`${origin}/auth/login`)
}
