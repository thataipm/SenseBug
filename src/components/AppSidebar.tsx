'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, BookOpen, User, LifeBuoy, LogOut, Zap, BarChart2, Inbox, Plug, Clock, X } from 'lucide-react'

interface JiraToast { title: string; priority: string; bug_id: string }

const NAV = [
  { href: '/dashboard',             icon: LayoutDashboard, label: 'Dashboard'    },
  { href: '/backlog',               icon: Inbox,           label: 'Backlog'       },
  { href: '/insights',              icon: BarChart2,       label: 'Insights'      },
  { href: '/historyRun',            icon: Clock,           label: 'History'       },
  { href: '/settings',              icon: BookOpen,        label: 'Knowledge Base'},
  { href: '/settings/integrations', icon: Plug,            label: 'Integrations'  },
  { href: '/account',               icon: User,            label: 'Account'       },
  { href: '/help',                  icon: LifeBuoy,        label: 'Help'          },
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
  const [email, setEmail]               = useState('')
  const [displayName, setDisplayName]   = useState('')
  const [plan, setPlan]                 = useState<PlanInfo | null>(null)
  const [unreviewedCount, setUnreviewed] = useState(0)
  const [jiraToast, setJiraToast]       = useState<JiraToast | null>(null)

  const refreshBadge = useCallback(() => {
    fetch('/api/backlog?count_only=true&status=unreviewed')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setUnreviewed(d.count ?? 0))
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setEmail(data.user.email ?? '')
      const meta = data.user.user_metadata ?? {}
      const full = meta.full_name || `${meta.first_name ?? ''} ${meta.last_name ?? ''}`.trim()
      setDisplayName(full)

      // Global Jira realtime subscription — shows a toast on any page when a
      // new bug arrives via the Jira webhook so the PM always gets notified.
      channel = supabase
        .channel('sidebar-jira-inserts')
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'backlog',
            filter: `user_id=eq.${data.user.id}`,
          },
          (payload) => {
            const entry = payload.new as { title: string; priority: string; bug_id: string; source_run_id: string | null }
            // Only show toast for Jira webhook bugs (source_run_id is null)
            if (entry.source_run_id !== null) return
            setJiraToast({ title: entry.title, priority: entry.priority, bug_id: entry.bug_id })
            setUnreviewed(prev => prev + 1)
          }
        )
        .subscribe()
    })
    fetch('/api/plan').then(r => r.ok ? r.json() : null).then(d => d && setPlan(d))
    refreshBadge()

    return () => { if (channel) createClient().removeChannel(channel) }
  }, [refreshBadge])

  // Auto-dismiss Jira toast after 7 seconds
  useEffect(() => {
    if (!jiraToast) return
    const t = setTimeout(() => setJiraToast(null), 7000)
    return () => clearTimeout(t)
  }, [jiraToast])

  // Re-fetch the unreviewed count whenever the window regains focus, or when
  // the backlog page dispatches a verdict/delete event.
  useEffect(() => {
    window.addEventListener('focus', refreshBadge)
    window.addEventListener('sensebug:badge-refresh', refreshBadge)
    return () => {
      window.removeEventListener('focus', refreshBadge)
      window.removeEventListener('sensebug:badge-refresh', refreshBadge)
    }
  }, [refreshBadge])

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
    <>
      {/* Global Jira sync toast — visible on any app page */}
      {jiraToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 bg-black text-white px-4 py-3 shadow-lg max-w-sm" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
          <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0 mt-1.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-mono uppercase tracking-widest text-white/50 mb-0.5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
              Synced from Jira · {jiraToast.priority}
            </p>
            <p className="text-sm font-medium truncate">{jiraToast.title}</p>
            <Link
              href="/backlog"
              className="text-[10px] font-mono text-white/50 hover:text-white transition-colors mt-0.5 inline-block"
              style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
              onClick={() => setJiraToast(null)}
            >
              Review in backlog →
            </Link>
          </div>
          <button onClick={() => setJiraToast(null)} className="text-white/40 hover:text-white flex-shrink-0 ml-1 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
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
          // Exact match, or prefix match — but only when no longer nav item is a more-specific prefix.
          // e.g. on /settings/integrations: '/settings' prefix-matches but '/settings/integrations' is an exact match,
          // so only the more-specific item should be active.
          const active = pathname === href || (
            href !== '/dashboard' &&
            pathname.startsWith(href + '/') &&
            !NAV.some(n => n.href !== href && pathname.startsWith(n.href) && n.href.startsWith(href))
          )
          const isBacklog = href === '/backlog'
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
              <span className="flex-1">{label}</span>
              {isBacklog && unreviewedCount > 0 && (
                <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-sm font-semibold leading-none ${
                  active ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'
                }`}>
                  {unreviewedCount > 99 ? '99+' : unreviewedCount}
                </span>
              )}
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
    </>
  )
}
