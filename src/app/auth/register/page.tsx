'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function RegisterPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isRegistered, setIsRegistered] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    setError(null)

    if (!email || !password || !fullName) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }

    if (password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }

    if (password !== confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน')
      return
    }

    setLoading(true)

    try {
      // สร้าง user ใหม่
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (signUpError) {
        if (signUpError.message.includes('already registered') || signUpError.message.includes('already exists')) {
          setError('Email นี้ถูกใช้งานแล้ว')
        } else if (signUpError.message.includes('Email rate limit')) {
          setError('ส่งคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่')
        } else {
          setError(signUpError.message)
        }
        return
      }

      if (data.user) {
        // รอเล็กน้อยให้ trigger สร้าง profile เสร็จก่อน
        await new Promise(resolve => setTimeout(resolve, 500))

        // อัปเดต profiles ให้ is_approved = false และ full_name
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: data.user.email,
            full_name: fullName,
            is_approved: false,
            role: 'user'
          }, { onConflict: 'id' })

        if (profileError) {
          console.error('Error upserting profile:', profileError)
        }

        // สร้าง employee record สำหรับรออนุมัติ (ถ้ายังไม่มี)
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
            console.error('Error creating employee:', empError)
          }
        }

        // Redirect ไปหน้า pending พร้อม email เพื่อแสดงสถานะรออนุมัติ
        window.location.href = `/auth/pending?email=${encodeURIComponent(email)}`
      }
    } catch (err) {
      console.error('Registration error:', err)
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRegister()
  }

  // แสดงหน้ารออนุมัติหลังสมัครเสร็จ
  if (isRegistered) {
    return (
      <main className="min-h-dvh grid place-items-center p-6 bg-gray-50">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">สมัครสมาชิกสำเร็จ</h1>
            <p className="text-sm text-gray-500 mt-1">รอการอนุมัติจากแอดมิน</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
              <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">บัญชีของคุณกำลังรอการอนุมัติ</p>
                <p className="text-amber-700/80">
                  แอดมินจะตรวจสอบและอนุมัติบัญชีของคุณในเร็วๆ นี้
                  คุณจะสามารถเข้าสู่ระบบได้หลังจากได้รับการอนุมัติแล้ว
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <span className="font-medium text-gray-900">Email: </span>
                {email}
              </p>
              <p>
                <span className="font-medium text-gray-900">สถานะ: </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  รออนุมัติ
                </span>
              </p>
            </div>

            <Link
              href="/auth/login"
              className="block w-full py-2.5 px-4 rounded-xl text-sm font-medium text-center text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
            >
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </main>
    )
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
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">สมัครสมาชิก</h1>
          <p className="text-sm text-gray-500 mt-1">สร้างบัญชีใหม่เพื่อใช้งานระบบ</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          {/* Email Form */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                ชื่อ-นามสกุล
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="ชื่อ นามสกุล"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all placeholder:text-gray-300"
              />
            </div>
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
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                ยืนยัน Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
            onClick={handleRegister}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 active:bg-gray-950 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                กำลังสมัคร...
              </span>
            ) : 'สมัครสมาชิก'}
          </button>

          <p className="text-center text-sm text-gray-500">
            มีบัญชีแล้ว?{' '}
            <Link href="/auth/login" className="text-gray-900 font-medium hover:underline">
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
