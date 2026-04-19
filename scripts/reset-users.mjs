/**
 * reset-users.mjs
 * Deletes all Supabase auth users + their associated data,
 * then creates a single fresh test user.
 *
 * Usage:  node scripts/reset-users.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://oxoobvbtuzkkimxpuqmd.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY env var is required')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── 1. List all users ──────────────────────────────────────────────────────────
console.log('\n🔍  Fetching existing users…')
const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
if (listError) { console.error('Failed to list users:', listError.message); process.exit(1) }
console.log(`    Found ${users.length} user(s)`)

// ── 2. Delete user data tables (CASCADE may not be set, so do it explicitly) ──
if (users.length > 0) {
  const userIds = users.map((u) => u.id)

  const tables = [
    'triage_results',   // via run_id → triage_runs
    'triage_runs',
    'kb_documents',
    'knowledge_base',
    'user_plans',
  ]

  console.log('\n🗑   Deleting user data…')
  for (const table of tables) {
    const col = table === 'triage_results' ? null : 'user_id'
    if (!col) {
      // triage_results links via run_id; delete through runs
      const { data: runs } = await supabase
        .from('triage_runs')
        .select('id')
        .in('user_id', userIds)
      if (runs?.length) {
        const runIds = runs.map((r) => r.id)
        const { error } = await supabase.from('triage_results').delete().in('run_id', runIds)
        if (error) console.warn(`    ⚠  triage_results: ${error.message}`)
        else console.log(`    ✓  triage_results (${runIds.length} runs cleared)`)
      } else {
        console.log(`    –  triage_results (no runs found)`)
      }
    } else {
      const { error, count } = await supabase
        .from(table)
        .delete({ count: 'exact' })
        .in('user_id', userIds)
      if (error) console.warn(`    ⚠  ${table}: ${error.message}`)
      else console.log(`    ✓  ${table} (${count ?? '?'} rows deleted)`)
    }
  }

  // ── 3. Delete auth users ───────────────────────────────────────────────────
  console.log('\n👤  Deleting auth users…')
  for (const user of users) {
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (error) console.warn(`    ⚠  ${user.email}: ${error.message}`)
    else console.log(`    ✓  ${user.email}`)
  }
}

// ── 4. Create fresh test user ──────────────────────────────────────────────────
const TEST_EMAIL    = 'test@sensebug.dev'
const TEST_PASSWORD = 'TestPass123!'

console.log('\n✨  Creating test user…')
const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
  email_confirm: true,   // skip email verification
})
if (createError) { console.error('Failed to create test user:', createError.message); process.exit(1) }

console.log(`    ✓  Created: ${newUser.user.email} (id: ${newUser.user.id})`)

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Test credentials
  Email    : ${TEST_EMAIL}
  Password : ${TEST_PASSWORD}
  URL      : http://localhost:3000/login
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
