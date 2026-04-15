import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Email ที่เป็น owner - อนุมัติอัตโนมัติ
const OWNER_EMAILS = ['realrockza@gmail.com']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // ดึง pathname
  const path = request.nextUrl.pathname

  // ยกเว้นหน้า auth ทั้งหมด (ไม่ต้องเช็คอะไร)
  if (path.startsWith('/auth/')) {
    return response
  }

  // ตรวจสอบ User และอัปเดต session
  const { data: { user } } = await supabase.auth.getUser()

  // กำหนดเส้นทาง
  const adminOnlyPaths = ['/employees', '/departments', '/price']
  const userPaths = ['/home', '/calendar', '/settings', '/map']
  const isAdminPath = adminOnlyPaths.some(p => path.startsWith(p))
  const isProtectedRoute = isAdminPath || userPaths.some(p => path.startsWith(p))

  // 1. ถ้ายังไม่ได้ login และเข้าหน้าที่ต้องการ login
  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // 2. ถ้า login แล้ว
  if (user) {
    try {
      // ดึงข้อมูล profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, is_approved')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Middleware profile fetch error:', profileError)
      }

      const userEmail = user.email || ''
      const isOwnerEmail = OWNER_EMAILS.includes(userEmail)
      // ถ้าเป็น owner email ให้ใช้ role 'owner' ทันที
      const userRole = isOwnerEmail ? 'owner' : (profile?.role || 'user')
      const isAdmin = userRole === 'admin' || userRole === 'owner'

      // admin/owner ถือว่าอนุมัติแล้วเสมอ
      const isApproved = isAdmin || profile?.is_approved === true || profile?.is_approved === null || isOwnerEmail

      // ถ้ายังไม่ได้รับการอนุมัติ → redirect ไป pending
      if (!isApproved) {
        return NextResponse.redirect(new URL('/auth/pending', request.url))
      }

      // อัปเดต profile ถ้าเป็น owner แต่ยังไม่มี role ที่ถูกต้อง
      if (isOwnerEmail && profile && profile.role !== 'admin' && profile.role !== 'owner') {
        supabase.from('profiles').update({ role: 'admin', is_approved: true }).eq('id', user.id).then()
      }

      // ถ้าเข้าหน้า Admin แต่ไม่ใช่ Admin/Owner → redirect ไป home
      if (isAdminPath && !isAdmin) {
        return NextResponse.redirect(new URL('/home', request.url))
      }
    } catch (err) {
      console.error('Middleware error:', err)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
