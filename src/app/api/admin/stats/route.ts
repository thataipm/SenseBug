import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function isAdmin(email: string | undefined): boolean {
  if (!email) return false
  const allowed = (process.env.ADMIN_EMAIL ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(email.toLowerCase())
}

export async function GET() {
  // Auth check — only the configured admin email(s) can call this
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // ── Fetch raw data ───────────────────────────────────────────────────────────
  const [
    { data: authData },
    { data: plans },
    { data: recentRunsData },
    { data: allRunsData },
    { data: recentFeedbackData },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000, page: 1 }),
    admin.from('user_plans').select('user_id, plan'),
    admin
      .from('triage_runs')
      .select('id, user_id, filename, bug_count, run_at')
      .gte('run_at', (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString() })())
      .order('run_at', { ascending: false }),
    admin.from('triage_runs').select('bug_count'),
    admin
      .from('feedback')
      .select('id, email, type, subject, message, created_at')
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  const users   = authData?.users ?? []
  const planMap = new Map((plans ?? []).map(p => [p.user_id, p.plan as string]))

  // ── Overview stats ───────────────────────────────────────────────────────────
  const now          = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const totalUsers        = users.length
  const newThisMonth      = users.filter(u => new Date(u.created_at) >= startOfMonth).length
  const proCount          = (plans ?? []).filter(p => p.plan === 'pro').length
  const maxCount          = (plans ?? []).filter(p => p.plan === 'max' || p.plan === 'team').length
  const starterCount      = (plans ?? []).filter(p => p.plan === 'starter').length
  const estimatedMRR      = proCount * 19 + maxCount * 49
  const totalRuns         = allRunsData?.length ?? 0
  const totalBugsAnalyzed = (allRunsData ?? []).reduce((s, r) => s + (r.bug_count ?? 0), 0)
  const conversionRate    = totalUsers > 0
    ? (((proCount + maxCount) / totalUsers) * 100).toFixed(1)
    : '0'

  // ── Chart data — last 30 days ────────────────────────────────────────────────
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const signupsByDate: Record<string, number> = {}
  users
    .filter(u => new Date(u.created_at) >= thirtyDaysAgo)
    .forEach(u => {
      const d = u.created_at.slice(0, 10)
      signupsByDate[d] = (signupsByDate[d] ?? 0) + 1
    })

  const runsByDate: Record<string, number> = {}
  ;(recentRunsData ?? []).forEach(r => {
    const d = r.run_at.slice(0, 10)
    runsByDate[d] = (runsByDate[d] ?? 0) + 1
  })

  const chartData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    const date = d.toISOString().slice(0, 10)
    return { date, signups: signupsByDate[date] ?? 0, runs: runsByDate[date] ?? 0 }
  })

  // ── Recent signups (latest 10) ───────────────────────────────────────────────
  const recentSignups = [...users]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
    .map(u => ({
      email:      u.email ?? '—',
      created_at: u.created_at,
      plan:       planMap.get(u.id) ?? 'starter',
    }))

  // ── Recent runs (latest 10) with email lookup ────────────────────────────────
  const recentRuns = (recentRunsData ?? []).slice(0, 10).map(r => {
    const u = users.find(u => u.id === r.user_id)
    return {
      email:     u?.email ?? '—',
      filename:  r.filename,
      bug_count: r.bug_count,
      run_at:    r.run_at,
    }
  })

  // ── Recent feedback (latest 15) ──────────────────────────────────────────────
  const recentFeedback = (recentFeedbackData ?? []).map(f => ({
    email:      f.email ?? '—',
    type:       f.type,
    subject:    f.subject,
    message:    f.message,
    created_at: f.created_at,
  }))

  return NextResponse.json({
    totalUsers,
    newThisMonth,
    proCount,
    maxCount,
    starterCount,
    estimatedMRR,
    totalRuns,
    totalBugsAnalyzed,
    conversionRate,
    chartData,
    recentSignups,
    recentRuns,
    recentFeedback,
  })
}
