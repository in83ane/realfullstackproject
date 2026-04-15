'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// Component ที่ใช้ useSearchParams ต้องอยู่ใน Suspense
function LoginForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // อ่าน error จาก URL (ถ้ามี)
  useEffect(() => {
    const errorParam = searchParams?.get('error')
    if (errorParam === 'auth_failed') {
      setError('การยืนยันตัวตนล้มเหลว กรุณาลองใหม่อีกครั้ง')
    }
  }, [searchParams])

  // Owner emails - bypass approval check
  const OWNER_EMAILS = ['realrockza@gmail.com']

  const handleLogin = async () => {
    setError(null)

    if (!email || !password) {
      setError('กรุณากรอก Email และ Password')
      return
    }

    // Owner email bypass
    if (OWNER_EMAILS.includes(email)) {
      setLoading(true)
      try {
        console.log('Attempting login for owner:', email)
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
        console.log('Login result:', { data, error: authError })
        if (authError) {
          console.error('Auth error:', authError)
          setError(authError.message)
          return
        }
        if (data?.session) {
          console.log('Login successful, session:', data.session)
          router.push('/home')
        } else {
          setError('ไม่พบ session กรุณาลองใหม่อีกครั้ง')
        }
        return
      } catch (err) {
        console.error('Login exception:', err)
        setError('เกิดข้อผิดพลาด')
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          setError('Email หรือ Password ไม่ถูกต้อง')
        } else if (authError.message.includes('Email not confirmed')) {
          setError('Email ยังไม่ได้ยืนยัน กรุณาตรวจสอบอีเมลของคุณ')
        } else {
          setError(authError.message)
        }
        return
      }

      // เช็คว่า user ได้รับการอนุมัติหรือยัง
      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('is_approved, role')
          .eq('id', data.user.id)
          .maybeSingle()

        // ถ้าไม่มี profile → ถือว่ายังไม่ได้อนุมัติ
        if (!profile && !profileError) {
          await supabase.auth.signOut()
          router.push('/auth/pending')
          return
        }

        // ตรวจสอบการอนุมัติ (admin/owner อนุมัติอัตโนมัติ)
        const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'
        const isApproved = profile?.is_approved === true || profile?.is_approved === null

        if (!isApproved && !isAdmin) {
          // ยังไม่ได้รับการอนุมัติ
          await supabase.auth.signOut()
          router.push(`/auth/pending?email=${encodeURIComponent(data.user.email || '')}`)
          return
        }
      }

      router.push('/home')
    } catch (err) {
      console.error('Login error:', err)
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ Google')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <main className="min-h-dvh grid place-items-center p-6 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-900 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">เข้าสู่ระบบ</h1>
          <p className="text-sm text-gray-500 mt-1">เข้าสู่ระบบเพื่อใช้งาน</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          {/* Email Form */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="your@email.com"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all placeholder:text-gray-300"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all placeholder:text-gray-300"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100">
              <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 active:bg-gray-950 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                กำลังเข้าสู่ระบบ...
              </span>
            ) : 'เข้าสู่ระบบ'}
          </button>

          <p className="text-center text-sm text-gray-500">
            ยังไม่มีบัญชี?{' '}
            <Link href="/auth/register" className="text-gray-900 font-medium hover:underline">
              สมัครสมาชิก
            </Link>
          </p>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-gray-400">หรือ</span>
            </div>
          </div>

          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            เข้าสู่ระบบด้วย Google
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          หากลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ
        </p>
      </div>
    </main>
  )
}

// Main export ที่ห่อด้วย Suspense
export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-dvh grid place-items-center p-6 bg-gray-50">
        <div className="w-full max-w-sm text-center">
          <div className="animate-spin w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full mx-auto" />
        </div>
      </main>
    }>
      <LoginForm />
    </Suspense>
  )
}
