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
          // Wait for session to be stored before redirecting
          await new Promise(resolve => setTimeout(resolve, 200))
          window.location.href = '/home'
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
          window.location.href = `/auth/pending?email=${encodeURIComponent(data.user.email || '')}`
          return
        }
      }

      // Wait for session to be stored before redirecting
      await new Promise(resolve => setTimeout(resolve, 200))
      window.location.href = '/home'
    } catch (err) {
      console.error('Login error:', err)
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
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
