'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, Settings, DollarSign, Map, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export default function Sidebar() {
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()

    async function loadRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          // Owner emails ได้ role 'owner' เสมอ
          const OWNER_EMAILS = ['realrockza@gmail.com']
          const isOwner = user.email ? OWNER_EMAILS.includes(user.email) : false
          const userRole = isOwner ? 'owner' : (profile?.role || 'user')
          setRole(userRole)

          // ถ้าเป็น admin หรือ owner ให้โหลดจำนวนที่รออนุมัติ
          if (userRole === 'admin' || userRole === 'owner') {
            const { count, error: countError } = await supabase
              .from('employees')
              .select('*', { count: 'exact', head: true })
              .eq('is_active', false)
              .not('user_id', 'is', null)
            if (countError) {
              console.error('Sidebar count error:', countError)
            }
            setPendingCount(count || 0)
          }
        }
      } catch (error) {
        console.error('Error loading role:', error)
      } finally {
        setLoading(false)
      }
    }

    loadRole()

    // ไม่มี Poll อัตโนมัติ - ต้องรีเฟรชเองถ้าต้องการอัปเดต badge
  }, [])

  const NAV = [
    { href: '/home',     label: 'หน้าหลัก', icon: Home },
    { href: '/price',    label: 'เช็คราคา', icon: DollarSign, adminOnly: true },
    { href: '/calendar', label: 'ตารางงาน', icon: Calendar },
    { href: '/map',      label: 'แผนที่',   icon: Map },
    { href: '/admin-management', label: 'จัดการแอดมิน', icon: Users, ownerOnly: true },
  ]

  const visibleNav = NAV.filter(({ adminOnly, ownerOnly }) => {
    if (loading) return false
    if (ownerOnly && role !== 'owner') return false
    if (adminOnly && role !== 'admin' && role !== 'owner') return false
    return true
  })

  return (
    <>
      {/* ─── Desktop Sidebar (≥ 1024px) ─────────────────────────────── */}
      <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-dvh w-20 border-r bg-white shadow-sm flex-col items-center">
        <div className="h-10 flex items-center justify-center" />

        <nav className="flex-1 w-full space-y-4 px-2 mt-4">
          {visibleNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname?.startsWith(href + '/')
            return (
              <div key={href} className="relative group flex justify-center">
                <Link
                  href={href}
                  className={cx(
                    'flex items-center justify-center rounded-2xl w-14 h-14 transition-all duration-200 outline-none',
                    active
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                      : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <Icon size={24} strokeWidth={active ? 2.5 : 2} />
                </Link>
                {/* Tooltip */}
                <div className={cx(
                  'absolute left-full top-1/2 z-50 ml-4 -translate-y-1/2',
                  'pointer-events-none whitespace-nowrap rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xl',
                  'opacity-0 transition-all duration-200 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0'
                )}>
                  {label}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-slate-900" />
                </div>
              </div>
            )
          })}
          {/* Employees Link with Badge - เฉพาะ admin และ owner */}
          {(role === 'admin' || role === 'owner') && (
            <div className="relative group flex justify-center">
              <Link
                href="/employees"
                className={cx(
                  'flex items-center justify-center rounded-2xl w-14 h-14 transition-all duration-200 outline-none relative',
                  pathname?.startsWith('/employees')
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Users size={24} strokeWidth={pathname?.startsWith('/employees') ? 2.5 : 2} />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </Link>
              <div className={cx(
                'absolute left-full top-1/2 z-50 ml-4 -translate-y-1/2',
                'pointer-events-none whitespace-nowrap rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xl',
                'opacity-0 transition-all duration-200 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0'
              )}>
                จัดการพนักงาน
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-slate-900" />
              </div>
            </div>
          )}
          {/* Settings Link */}
          <div className="relative group flex justify-center">
            <Link
              href="/settings"
              className={cx(
                'flex items-center justify-center rounded-2xl w-14 h-14 transition-all duration-200 outline-none',
                pathname?.startsWith('/settings')
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                  : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <Settings size={24} strokeWidth={pathname?.startsWith('/settings') ? 2.5 : 2} />
            </Link>
            <div className={cx(
              'absolute left-full top-1/2 z-50 ml-4 -translate-y-1/2',
              'pointer-events-none whitespace-nowrap rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xl',
              'opacity-0 transition-all duration-200 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0'
            )}>
              ตั้งค่า
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-slate-900" />
            </div>
          </div>
        </nav>
      </aside>

      {/* ─── Mobile / Tablet Bottom Nav (< 1024px) ───────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
        {/* Safe area สำหรับ iPhone (home indicator) */}
        <div className="flex items-center justify-around px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {visibleNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname?.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-1 min-w-[3rem] py-1 px-2 rounded-xl transition-all duration-200 active:scale-95"
              >
                <div className={cx(
                  'flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200',
                  active
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-400'
                )}>
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                </div>
                <span className={cx(
                  'text-[10px] font-medium leading-none transition-colors duration-200',
                  active ? 'text-slate-900' : 'text-slate-400'
                )}>
                  {label}
                </span>
              </Link>
            )
          })}
          {/* Employees Link for Mobile - เฉพาะ admin และ owner */}
          {(role === 'admin' || role === 'owner') && (
            <Link
              href="/employees"
              className="flex flex-col items-center gap-1 min-w-[3rem] py-1 px-2 rounded-xl transition-all duration-200 active:scale-95 relative"
            >
              <div className={cx(
                'flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200',
                pathname?.startsWith('/employees')
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-400'
              )}>
                <Users size={20} strokeWidth={pathname?.startsWith('/employees') ? 2.5 : 2} />
                {pendingCount > 0 && (
                  <span className="absolute -top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full min-w-[16px] flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </div>
              <span className={cx(
                'text-[10px] font-medium leading-none transition-colors duration-200',
                pathname?.startsWith('/employees') ? 'text-slate-900' : 'text-slate-400'
              )}>
                พนักงาน
              </span>
            </Link>
          )}
          {/* Settings Link for Mobile */}
          <Link
            href="/settings"
            className="flex flex-col items-center gap-1 min-w-[3rem] py-1 px-2 rounded-xl transition-all duration-200 active:scale-95"
          >
            <div className={cx(
              'flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200',
              pathname?.startsWith('/settings')
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-400'
            )}>
              <Settings size={20} strokeWidth={pathname?.startsWith('/settings') ? 2.5 : 2} />
            </div>
            <span className={cx(
              'text-[10px] font-medium leading-none transition-colors duration-200',
              pathname?.startsWith('/settings') ? 'text-slate-900' : 'text-slate-400'
            )}>
              ตั้งค่า
            </span>
          </Link>
        </div>
      </nav>
    </>
  )
}
