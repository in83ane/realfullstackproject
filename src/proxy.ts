import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
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

  // ตรวจสอบ User
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

      // ถ้ามี error ที่ไม่ใช่ "ไม่พบข้อมูล" ให้ log ไว้
      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Middleware profile fetch error:', profileError)
      }

      const userRole = profile?.role || 'user'
      const isAdmin = userRole === 'admin' || userRole === 'owner'

      // สำคัญ: admin/owner ถือว่าอนุมัติแล้วเสมอ
      // หรือถ้า is_approved เป็น null (user เก่า) หรือ true → อนุมัติแล้ว
      const isApproved = isAdmin || profile?.is_approved === true || profile?.is_approved === null

      // ถ้ายังไม่ได้รับการอนุมัติ → redirect ไป pending
      if (!isApproved) {
        return NextResponse.redirect(new URL('/auth/pending', request.url))
      }

      // ถ้าเข้าหน้า Admin แต่ไม่ใช่ Admin/Owner → redirect ไป home
      if (isAdminPath && !isAdmin) {
        return NextResponse.redirect(new URL('/home', request.url))
      }
    } catch (err) {
      console.error('Middleware error:', err)
      // ในกรณี error ให้ผ่านไปก่อน (fail open) เพื่อไม่ block user
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
