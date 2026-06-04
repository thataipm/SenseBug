# SenseBug — Bug Backlog Intelligence

> Connect Jira (or upload a CSV). Every bug is automatically scored by business impact, the backlog continuously re-ranks itself, and every priority comes with a written rationale.

SenseBug is an AI intelligence layer for bug backlogs, built for product managers who own triage. Instead of a flat list of inconsistently-prioritized tickets, it gives the PM a defensible, consistent, automatically-updated point of view they can stand behind and share upward.

**Live (when running):** [sensebug.com](https://www.sensebug.com) · **Status:** Built and shipped solo, 2026

---

## The problem it solves

PMs who own a bug backlog face the same recurring problem every sprint: deciding what matters, then defending those decisions to engineering, sales, and leadership. Engineers file everything as Critical. Sales escalates whoever complained loudest. Leadership asks why a given bug is or isn't being worked on. The backlog offers no narrative.

SenseBug reads every ticket against the product's critical flows, strips reporter bias, ranks by real business impact, and writes a one-line rationale for every call — so the PM walks into sprint planning with evidence, not opinions.

---

## Key features

- **Live Jira integration** — a webhook fires on every new/updated bug; it's analysed and prioritized the moment it's filed. No manual exports.
- **CSV upload** — drop an export from Jira, Linear, GitHub Issues, Shortcut, Asana, or anywhere. Smart column detection + fuzzy header matching.
- **Two-pass AI analysis** — Haiku for fast batch scoring (priority, severity, quality flags); Sonnet for on-demand deep analysis (business impact, rationale, ticket rewrites).
- **Continuous re-ranking** — when a new bug arrives, the whole open backlog re-orders automatically. No stale rankings, no manual triage runs.
- **PM calibration** — after 30 verdicts, the system learns the team's judgment (what they treat as P1, what they downgrade) and injects that pattern into every future analysis.
- **Reporter-bias removal** — the model derives priority from ticket content, explicitly ignoring the reporter's self-assigned label.
- **Knowledge Base + RAG** — product context and uploaded docs (PDF/Word/MD) are embedded into pgvector and retrieved per-bug for product-aware ranking.
- **Backlog health score** — a 0-100 score with week-over-week trend, plus a weekly email digest.
- **Jira write-back** — approved priorities sync back to the ticket with an AI summary comment.

---

## Engineering highlights

A few decisions worth calling out:

- **Serverless-aware AI pipeline** — batch LLM calls run with bounded concurrency and retry logic; long-running work (Jira write-back, calibration recompute) uses Vercel's `waitUntil` so the response returns instantly while side-effects finish in the background.
- **Idempotent bulk sync** — the "import all Jira bugs" endpoint paginates through the Jira REST API, skips already-imported bugs, respects the user's monthly quota, and self-limits against the function timeout with an in-flight advisory lock to prevent double-counting on parallel runs.
- **Two-tier model strategy for cost** — Haiku (cheap, fast) handles the high-volume batch scoring; Sonnet (higher quality) is reserved for on-demand per-bug detail. Keeps AI cost at roughly $0.02/bug.
- **Trial system** — 14-day no-credit-card trial computed from a single `getPlanStatus()` source of truth, with consistent expiry gating across every AI-consuming endpoint and a daily reminder cron.
- **Row-Level Security throughout** — every user-data table is RLS-protected; every API route is auth-gated with ownership checks on mutations.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, React 19, Tailwind CSS |
| Hosting | Vercel (serverless functions + cron) |
| Database / Auth | Supabase (Postgres, pgvector, Row-Level Security) |
| AI | Anthropic Claude (Haiku + Sonnet), OpenAI embeddings |
| Email | Resend |
| Billing | DodoPayments |

--
