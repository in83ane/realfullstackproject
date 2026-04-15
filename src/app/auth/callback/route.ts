import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Email ที่อนุมัติอัตโนมัติ (ไม่ต้องรอ admin)
const AUTO_APPROVED_EMAILS = ['realrockza@gmail.com']

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
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

      // ถ้ามี error ที่ไม่ใช่ "ไม่พบข้อมูล" ให้ log ไว้
      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile fetch error:', profileError)
      }

      const fullName = data.user.user_metadata?.full_name ||
                       data.user.user_metadata?.name ||
                       profile?.full_name ||
                       data.user.email?.split('@')[0] ||
                       'New User'

      // เช็คว่าเป็น auto-approved email หรือไม่
      const userEmail = data.user.email || ''
      const isAutoApproved = AUTO_APPROVED_EMAILS.includes(userEmail)

      // ถ้าไม่มี profile หรือ is_approved ยังไม่ถูกตั้งค่า (user ใหม่)
      const isNewUser = !profile || profile.is_approved === null || profile.is_approved === undefined

      if (isNewUser) {
        // ตั้งค่า is_approved = true สำหรับ auto-approved, false สำหรับคนอื่น
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: data.user.email,
            is_approved: isAutoApproved,  // true สำหรับ auto-approved emails
            full_name: fullName,
            role: isAutoApproved ? 'admin' : 'user'  // ให้ admin role ถ้า auto-approved
          }, { onConflict: 'id' })

        if (upsertError) {
          console.error('Profile upsert error:', upsertError)
        }

        // ตรวจสอบว่ามี employee record อยู่แล้วหรือไม่
        const { data: existingEmployee } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', data.user.id)
          .maybeSingle()

        // สร้าง employee record สำหรับรออนุมัติ (ถ้ายังไม่มี)
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

        // Redirect ไปหน้า home ถ้า auto-approved, ไปหน้ารออนุมัติถ้าไม่ใช่
        if (isAutoApproved) {
          return NextResponse.redirect(`${origin}/home`)
        }
        return NextResponse.redirect(`${origin}/auth/pending?email=${encodeURIComponent(data.user.email || '')}`)
      }

      // ถ้ายังไม่ได้รับการอนุมัติ และไม่ใช่ admin/owner
      // แต่ถ้าเป็น auto-approved email → อัปเดตให้เป็น approved และ admin
      if (!profile.is_approved && profile.role !== 'admin' && profile.role !== 'owner') {
        if (isAutoApproved) {
          // อัปเดต profile ให้เป็น approved และ admin
          await supabase
            .from('profiles')
            .update({ is_approved: true, role: 'admin' })
            .eq('id', data.user.id)
          return NextResponse.redirect(`${origin}/home`)
        }
        return NextResponse.redirect(`${origin}/auth/pending?email=${encodeURIComponent(data.user.email || '')}`)
      }

      // ผ่านการอนุมัติแล้ว หรือเป็น admin/owner
      return NextResponse.redirect(`${origin}/home`)
    } catch (err) {
      console.error('Callback processing error:', err)
      return NextResponse.redirect(`${origin}/auth/login?error=server_error`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login`)
}
