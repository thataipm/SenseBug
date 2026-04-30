'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, Clock, BookOpen, User, LifeBuoy, LogOut, Zap, BarChart2 } from 'lucide-react'

const NAV = [
  { href: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard'       },
  { href: '/insights',    icon: BarChart2,       label: 'Insights'         },
  { href: '/historyRun',  icon: Clock,           label: 'History'          },
  { href: '/settings',    icon: BookOpen,        label: 'Knowledge Base'   },
  { href: '/account',     icon: User,            label: 'Account'          },
  { href: '/help',        icon: LifeBuoy,        label: 'Help'             },
]

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter', pro: 'Pro', team: 'Max', max: 'Max', admin: 'Admin',
}

interface PlanInfo {
  plan: string
  monthly_bug_limit: number
  bugs_analyzed_this_month: number
}

export function AppSidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const [email, setEmail]       = useState('')
  const [displayName, setDisplayName] = useState('')
  const [plan, setPlan]         = useState<PlanInfo | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? '')
        const meta = data.user.user_metadata ?? {}
        const full = meta.full_name || `${meta.first_name ?? ''} ${meta.last_name ?? ''}`.trim()
        setDisplayName(full)
      }
    })
    fetch('/api/plan').then(r => r.ok ? r.json() : null).then(d => d && setPlan(d))
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const used      = plan?.bugs_analyzed_this_month ?? 0
  const limit     = plan?.monthly_bug_limit ?? 0
  const hasLimit  = limit !== -1
  const pct       = hasLimit && limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const nearLimit = pct > 80

  return (
    <aside
      className="hidden md:flex w-56 flex-shrink-0 border-r border-gray-200 flex-col bg-white"
      style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-gray-100 flex-shrink-0">
        <Link
          href="/dashboard"
          className="font-black text-lg tracking-tight"
          style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
        >
          SENSEBUG AI
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm mb-0.5 transition-colors duration-100 ${
                active
                  ? 'bg-black text-white font-medium'
                  : 'text-black/55 hover:text-black hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={active ? 2.5 : 1.5} />
              {label}
            </Link>
          )
        })}
        {/* Upgrade shortcut — only for Starter users */}
        {plan?.plan === 'starter' && (
          <Link
            href="/pricing"
            className="flex items-center gap-3 px-3 py-2.5 text-sm mt-1 bg-black text-white font-medium hover:bg-black/80 transition-colors duration-100"
          >
            <Zap className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
            Upgrade
          </Link>
        )}
      </nav>

      {/* Plan quota */}
      {plan && (
        <div className="px-4 py-4 border-t border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-xs font-mono uppercase tracking-widest text-black/45"
              style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
            >
              {PLAN_LABEL[plan.plan] ?? plan.plan}
            </span>
            {plan.plan === 'starter' && (
              <Link
                href="/pricing"
                className="text-xs text-black/35 hover:text-black transition-colors"
              >
                Upgrade →
              </Link>
            )}
          </div>
          {hasLimit && (
            <>
              <div className="w-full h-1 bg-gray-100 overflow-hidden mb-1.5">
                <div
                  className={`h-full transition-all duration-300 ${nearLimit ? 'bg-orange-400' : 'bg-black'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p
                className="text-xs text-black/35 tabular-nums"
                style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
              >
                {used} / {limit} bugs used
              </p>
            </>
          )}
        </div>
      )}

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-100 flex-shrink-0">
        {displayName && (
          <p className="text-xs font-medium text-black/70 truncate mb-0.5">{displayName}</p>
        )}
        {email && (
          <p className="text-xs text-black/35 truncate mb-2.5">{email}</p>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-xs text-black/40 hover:text-black transition-colors duration-150"
        >
          <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
