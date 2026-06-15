# SenseBug — Demo Runbook

A guide for demoing SenseBug (e.g. in an interview) after the project was parked. Read this first; future-you will not remember the details.

---

## ⚠️ Read this first: what's broken when parked

The project was parked in 2026 with Vercel downgraded to Hobby. As a result:

| Thing | State when parked | Why |
|---|---|---|
| **Live triage on sensebug.com** | ❌ Times out | Vercel Hobby caps functions at 10s; the AI pipeline needs longer |
| **Supabase database** | ⏸️ Auto-pauses after ~7 days idle | Free-tier behavior — must be manually resumed |
| **Vercel crons** | ❌ Removed from vercel.json | Hobby allows max 2 crons, once-daily; our config exceeded that and blocked deploys |
| **Local dev (`yarn dev`)** | ✅ Fully works | No function timeout locally |

**Bottom line: do NOT demo from the live URL. Demo locally, or use the recorded video.**

### Restoring crons when you upgrade to Vercel Pro

`vercel.json` was emptied to `{ "crons": [] }` so Hobby would accept deploys.
The cron *route files* are all still in `src/app/api/cron/`. To re-enable the
schedule after upgrading to Pro, paste this back into `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/renewal-reminder", "schedule": "0 8 * * *" },
    { "path": "/api/cron/trial-reminders",  "schedule": "0 9 * * *" },
    { "path": "/api/cron/weekly-digest",    "schedule": "0 8 * * 1" },
    { "path": "/api/cron/jira-sync",         "schedule": "*/30 * * * *" }
  ]
}
```

---

## The three ways to demo (best first)

### Option A — Play the recorded walkthrough (zero risk)
A full Loom walkthrough was recorded while everything worked. This never fails, never depends on a paused database or valid keys. **This is the default for interviews.** [→ paste Loom link here]

A local copy of the video is saved at: `[fill in path]`

### Option B — Run it locally (live, but reliable)
The local dev server has no timeout, so all features work. ~3 minutes to spin up. Use this when someone wants to drive it live or poke at edge cases. Steps below.

### Option C — Temporarily re-upgrade Vercel (for a serious live opportunity)
If a company specifically wants the live hosted product:
1. Re-upgrade Vercel to Pro ($20/mo)
2. Resume the Supabase project (see below)
3. Demo on sensebug.com
4. Downgrade afterward

Only worth it for a real, high-stakes opportunity — not standing.

---

## Local setup (Option B), step by step

```bash
# 1. Clone (if not already on this machine)
git clone https://github.com/thataipm/SenseBug.git
cd SenseBug/frontend

# 2. Restore .env.local
#    The keys are backed up in [your password manager / location].
#    Without these, nothing works — see "Reviving the backend" below.

# 3. Install + run
yarn install
yarn dev
```

Open http://localhost:3000.

### Reviving the backend (if Supabase has paused)

1. Log into [supabase.com](https://supabase.com) → open the SenseBug project
2. If it shows **"Project paused"**, click **Restore** — takes ~2 minutes
3. Verify the AI keys are still valid:
   - Anthropic console — check the API key hasn't been revoked and billing is active
   - OpenAI console — same
4. If a key lapsed, generate a new one and update `.env.local`

---

## The demo script (~5 minutes)

A tested flow that shows range without dragging. Log in first with the **admin account** (the email in `ADMIN_EMAIL`) — it bypasses trial limits so nothing gets in the way.

**1. The hook (30s)** — Land on the dashboard. Say:
> "SenseBug is bug backlog intelligence. The problem it solves: PMs spend every sprint defending triage decisions to engineering and sales. This gives them a defensible, data-backed point of view instead."

**2. Upload (60s)** — Upload `demo-backlog.csv`. While it processes, explain the two-pass approach:
> "It's running each bug through Claude — scoring by business impact against the product's critical flows, deliberately ignoring the reporter's own priority label since reporters inflate their own bugs."

**3. The payoff (90s)** — Show the ranked results. Point out specific wins:
> - "BUG-1045 — the reporter filed this cosmetic color tweak as **P1**. SenseBug downgraded it to P4 and flagged it 'likely over-prioritised.' That's the PM's cover to say no."
> - "BUG-1051 — session expiring every 5 minutes — correctly elevated to P1. Site-wide auth failure."
> - "BUG-1042 and BUG-1050 — flagged as **possible duplicates**. Same iOS checkout bug filed twice."
> - "BUG-1044 — the rounding error on invoices — elevated because it touches **audited financial statements**, even though the reporter marked it P3."

**4. Depth (60s)** — Open one bug to show the Sonnet-generated detail: business impact, full rationale, and a rewritten ticket description for the vague ones. Then show the **backlog health score**.

**5. The moat (60s)** — Open Settings → Integrations → Jira. Explain:
> "The real product is the live Jira integration — a webhook means every bug is analysed the moment it's filed, and the whole backlog re-ranks automatically. And it learns: after 30 PM verdicts, it calibrates to that team's specific judgment. That's the part you can't replicate by pasting a CSV into ChatGPT."

---

## Talking points (likely questions)

**"Why did you stop?"**
> Validation honesty. I built a complete, polished product, but the market signal during early outreach didn't justify continuing to invest. I'd rather kill it cleanly than sink months into something without pull. The build itself was the goal — it's a full-stack AI product end to end.

**"How is this different from just using ChatGPT/Claude?"**
> Three things a chat tool can't do: it runs continuously via live Jira integration (no manual exports), it maintains persistent backlog state and re-ranks automatically, and it learns the specific team's judgment over time. The analysis isn't the moat — the integration, state, and calibration are.

**"What was the hardest technical part?"**
> Making an AI pipeline work reliably on serverless. Function timeouts, batch concurrency, retry logic, and using `waitUntil` to push side-effects to the background so the user gets an instant response. Plus a trial/billing system with consistent gating across every AI endpoint.

**"What would you do differently?"**
> Validate demand before building. I built first and validated second — the reverse of what I should have done. The product is good; I'm not sure the pain was acute enough to be a budgeted purchase. I'd pre-sell next time.

**"Walk me through the architecture."**
> Next.js on Vercel, Supabase for Postgres + auth + pgvector, Claude for the two-pass analysis (Haiku for batch, Sonnet for depth), OpenAI for embeddings. RLS on every table, webhook-driven Jira sync, cron jobs for digests and trial reminders.

---

## Pre-interview checklist (run the morning of)

- [ ] Supabase project resumed (not paused)
- [ ] `yarn dev` starts clean, loads localhost:3000
- [ ] Logged in with admin account
- [ ] `demo-backlog.csv` uploads and triages successfully (do a dry run!)
- [ ] Loom link handy as backup if local breaks
- [ ] A real bug detail page loads with Sonnet analysis (confirms AI keys valid)

---

*If you're reading this months later and the local setup fights you: the recorded Loom (Option A) is always the safe fallback. Lead with that.*
