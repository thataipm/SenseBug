import Link from 'next/link'

const MONO = { fontFamily: 'var(--font-ibm-plex-mono), monospace' }
const HEAD = { fontFamily: 'var(--font-space-grotesk), sans-serif' }

export default function HowToPrioritizeBugs() {
  return (
    <article className="space-y-6 text-black/75 leading-relaxed" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>

      <p className="text-lg text-black/80 leading-relaxed font-medium">
        Every product manager knows the feeling. You open your bug tracker on a Monday morning
        and find 47 tickets — 31 of them marked P1. Your lead engineer wants to fix the login
        button alignment. The sales team has escalated a CSS issue they&apos;ve &ldquo;promised a
        customer.&rdquo; And buried at the bottom, marked P3 by an intern, is a payment flow
        bug that&apos;s been silently failing for two weeks.
      </p>

      <p>
        This is bug triage — and for most PMs, it&apos;s the most frustrating hour of the sprint.
      </p>

      {/* ── Section 1 ── */}
      <h2 className="text-2xl font-black tracking-tight pt-4" style={HEAD}>
        Why Your Priority Labels Don&apos;t Mean What You Think
      </h2>

      <p>
        The problem isn&apos;t that your team files bugs wrong. The problem is that priority is
        subjective by nature — and everyone optimises for their own definition of urgent.
      </p>
      <p>
        Engineers want to fix what interests them technically. Sales marks everything critical
        when a customer mentions it. QA testers file high priority because they found the bug
        and it feels important. Customer success escalates whatever the loudest customer
        complained about last.
      </p>
      <p>
        By the time a ticket reaches your backlog, its priority label reflects <em>politics</em>,
        not <em>product reality</em>.
      </p>

      <p>This creates three downstream problems:</p>

      <div className="space-y-4 pl-4 border-l-2 border-gray-200">
        <div>
          <p className="font-semibold text-black">1. The high-priority backlog becomes noise.</p>
          <p className="text-sm mt-1">
            When everything is P1, nothing is P1. You can&apos;t triage effectively when 60% of
            your backlog claims to be on fire.
          </p>
        </div>
        <div>
          <p className="font-semibold text-black">2. Real issues get buried.</p>
          <p className="text-sm mt-1">
            The checkout bug filed as P3 because &ldquo;it only happens on Safari&rdquo; could
            be blocking 18% of your mobile revenue. It doesn&apos;t get seen because
            it&apos;s not loud.
          </p>
        </div>
        <div>
          <p className="font-semibold text-black">3. You&apos;re solving the wrong problems.</p>
          <p className="text-sm mt-1">
            Teams that ship based on political priority consistently fix the wrong things first.
            The cost shows up three months later as preventable churn.
          </p>
        </div>
      </div>

      {/* ── Section 2 ── */}
      <h2 className="text-2xl font-black tracking-tight pt-4" style={HEAD}>
        The Four Signals That Actually Matter
      </h2>

      <p>Good bug triage ignores the priority label entirely and evaluates four things:</p>

      <div className="space-y-5">
        {[
          {
            n: '01',
            title: 'User impact',
            body: 'How many users are affected — and which users? Free, paying, enterprise? A bug blocking 5% of users in your checkout flow is more urgent than one affecting 40% of users on a rarely-visited settings page.',
          },
          {
            n: '02',
            title: 'Revenue risk',
            body: "Does this bug live in a path that generates or protects revenue? Checkout, onboarding, billing, core product loops — bugs here have a direct dollar value attached. A bug in invoice download hits a different nerve than one in notification preferences.",
          },
          {
            n: '03',
            title: 'Reproducibility',
            body: 'Is it always reproducible, sometimes, or only under specific conditions? An always-reproducible bug in a critical flow is an emergency. An intermittent bug in a low-traffic area is a scheduled fix.',
          },
          {
            n: '04',
            title: 'Workaround availability',
            body: 'Can users get around the bug? A broken button with a keyboard shortcut alternative is lower urgency than a blank screen. Not because the bug is less real — because the business impact is lower while the fix is pending.',
          },
        ].map(s => (
          <div key={s.n} className="flex gap-4">
            <span className="text-xs font-mono text-black/25 mt-1 flex-shrink-0 w-6" style={MONO}>{s.n}</span>
            <div>
              <p className="font-semibold text-black mb-1">{s.title}</p>
              <p className="text-sm">{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Section 3 ── */}
      <h2 className="text-2xl font-black tracking-tight pt-4" style={HEAD}>
        A Practical Triage Framework
      </h2>

      <p>Here&apos;s a repeatable process for doing this well — without spending your entire afternoon on it.</p>

      <div className="space-y-4">
        {[
          {
            step: 'Step 1',
            title: 'Strip the priority label',
            body: "Before you read anything else about a ticket, ignore the priority column entirely. It's been set by someone with a different agenda. Start fresh.",
          },
          {
            step: 'Step 2',
            title: 'Read the description for signal words',
            body: 'Certain phrases indicate genuine urgency regardless of the filed priority: "blocking our launch," "customer threatening to churn," "payment failing," "data loss." Other phrases are low impact dressed as urgent: "looks unprofessional," "slightly wrong," "we should fix this eventually."',
          },
          {
            step: 'Step 3',
            title: 'Map it to your critical flows',
            body: "Every product has 4–8 flows that, if broken, hurt real users and real revenue. For each bug, ask: is this in one of those flows? If yes, it's a candidate for your top 10 regardless of how it was filed.",
          },
          {
            step: 'Step 4',
            title: 'Score and stack rank',
            body: 'For each bug, score the four signals (1–3 scale, keep it simple). The bugs that score highest across all four signals go to the top. You don\'t need a formula — you need a consistent mental model.',
          },
          {
            step: 'Step 5',
            title: 'Gut-check the bottom',
            body: 'Look at the lowest-ranked bugs. Is anything there that looks wrong? Sometimes a ticket is deceptively short and filed low, but reading between the lines reveals it\'s actually critical. This catches the outliers your scoring misses.',
          },
        ].map((s, i) => (
          <div key={i} className="border border-gray-100 p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-black/35 mb-1" style={MONO}>{s.step}</p>
            <p className="font-semibold text-black mb-1.5" style={HEAD}>{s.title}</p>
            <p className="text-sm">{s.body}</p>
          </div>
        ))}
      </div>

      {/* ── Section 4 ── */}
      <h2 className="text-2xl font-black tracking-tight pt-4" style={HEAD}>
        Common Mistakes to Avoid
      </h2>

      <div className="space-y-4">
        {[
          {
            title: 'Recency bias',
            body: "Fixing whatever was filed last week because it's fresh in everyone's mind. The age of a ticket is irrelevant to its urgency.",
          },
          {
            title: 'Squeaky wheel prioritization',
            body: "The loudest stakeholder gets their bug fixed first. This isn't triage — it's negotiation. It rewards escalation culture and punishes teams who trust the process.",
          },
          {
            title: 'Confusing severity with priority',
            body: "A Critical severity bug (technically bad) is not automatically P1 priority (business urgent). A cosmetic bug that breaks the checkout flow is low severity but high priority. A database corruption issue in a feature nobody uses is high severity but low priority. These are different scales.",
          },
          {
            title: 'Letting the backlog grow unchecked',
            body: "Triage only works if it's a regular habit. A backlog that hasn't been triaged in six weeks requires an afternoon of archaeology. Weekly or bi-weekly triage keeps it manageable.",
          },
        ].map((m, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-black/20 mt-1 flex-shrink-0">—</span>
            <div>
              <p className="font-semibold text-black">{m.title}</p>
              <p className="text-sm mt-0.5">{m.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Section 5: Before / After ── */}
      <h2 className="text-2xl font-black tracking-tight pt-4" style={HEAD}>
        What Good Triage Looks Like in Practice
      </h2>

      <p>Here&apos;s a before/after from a real triage session:</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
        {/* Before */}
        <div className="border border-gray-200 p-5">
          <p className="text-xs font-mono uppercase tracking-widest text-black/30 mb-4" style={MONO}>
            Before — Reporter priorities
          </p>
          <div className="space-y-2.5">
            {[
              { rank: '1', label: 'P1', color: 'text-red-600 bg-red-50 border-red-200',    title: 'Update our logo on login page' },
              { rank: '2', label: 'P1', color: 'text-red-600 bg-red-50 border-red-200',    title: 'Button colour is slightly wrong' },
              { rank: '3', label: 'P1', color: 'text-red-600 bg-red-50 border-red-200',    title: 'Dashboard loads slowly' },
              { rank: '4', label: 'P2', color: 'text-orange-600 bg-orange-50 border-orange-200', title: 'Login loop on password reset' },
              { rank: '5', label: 'P3', color: 'text-yellow-700 bg-yellow-50 border-yellow-200', title: 'Checkout fails on mobile Safari' },
            ].map(r => (
              <div key={r.rank} className="flex items-center gap-2.5 py-1.5 border-b border-gray-100 last:border-0">
                <span className="text-xs font-mono text-black/25 w-3 flex-shrink-0" style={MONO}>{r.rank}</span>
                <span className={`text-xs font-mono px-1.5 py-0.5 border flex-shrink-0 ${r.color}`} style={MONO}>{r.label}</span>
                <span className="text-xs text-black/60">{r.title}</span>
              </div>
            ))}
          </div>
        </div>
        {/* After */}
        <div className="border border-black p-5">
          <p className="text-xs font-mono uppercase tracking-widest text-black/30 mb-4" style={MONO}>
            After — Impact-ranked
          </p>
          <div className="space-y-2.5">
            {[
              { rank: '1', label: 'P1', color: 'text-red-600 bg-red-50 border-red-200',    title: 'Checkout fails on mobile Safari', note: '' },
              { rank: '2', label: 'P1', color: 'text-red-600 bg-red-50 border-red-200',    title: 'Login loop on password reset', note: '' },
              { rank: '3', label: 'P3', color: 'text-yellow-700 bg-yellow-50 border-yellow-200', title: 'Dashboard loads slowly', note: 'workaround exists' },
              { rank: '4', label: 'P4', color: 'text-black/40 bg-gray-50 border-gray-200', title: 'Button colour is slightly wrong', note: '⚑ over-pri' },
              { rank: '5', label: 'P4', color: 'text-black/40 bg-gray-50 border-gray-200', title: 'Update our logo on login page', note: '⚑ over-pri' },
            ].map(r => (
              <div key={r.rank} className="flex items-center gap-2.5 py-1.5 border-b border-gray-100 last:border-0">
                <span className="text-xs font-mono text-black/25 w-3 flex-shrink-0" style={MONO}>{r.rank}</span>
                <span className={`text-xs font-mono px-1.5 py-0.5 border flex-shrink-0 ${r.color}`} style={MONO}>{r.label}</span>
                <span className={`text-xs flex-1 ${r.rank === '4' || r.rank === '5' ? 'text-black/35' : 'text-black/70'}`}>{r.title}</span>
                {r.note && <span className="text-xs font-mono text-purple-500 flex-shrink-0" style={MONO}>{r.note}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p>
        Same five tickets. Completely different picture. The checkout bug was always the emergency
        — it just wasn&apos;t the loudest voice in the room.
      </p>

      {/* ── Section 6 ── */}
      <h2 className="text-2xl font-black tracking-tight pt-4" style={HEAD}>
        When Manual Triage Breaks Down
      </h2>

      <p>
        This framework works well for backlogs of 20–30 bugs reviewed weekly. It starts to break
        down when:
      </p>

      <ul className="space-y-1.5 pl-5 list-disc text-sm">
        <li>Your backlog has 50+ unreviewed tickets</li>
        <li>Bugs are being filed from multiple contexts — sales, engineering, QA, customer support — each with different standards</li>
        <li>You&apos;re running triage under time pressure, 20 minutes before sprint planning starts</li>
        <li>Ticket quality is inconsistent — some have detailed repro steps, others are three words</li>
      </ul>

      <p>
        At that scale, the mental load of applying four signals to 60 tickets is significant. You
        make shortcuts. You skim. You default to the loudest complaint. The political priority
        problem reasserts itself because doing it properly takes too long.
      </p>

      {/* ── Section 7: AI ── */}
      <h2 className="text-2xl font-black tracking-tight pt-4" style={HEAD}>
        How AI Is Changing Bug Triage
      </h2>

      <p>
        The triage framework above is sound. The problem is the execution cost at scale.
      </p>
      <p>
        This is where AI triage tools are genuinely useful. Tools like{' '}
        <Link href="https://www.sensebug.com" className="text-black font-medium underline hover:no-underline">
          SenseBug AI
        </Link>{' '}
        apply a consistent scoring model to every ticket in your backlog — reading descriptions
        for escalation signals, ignoring reporter labels, cross-referencing bugs against your
        product&apos;s critical flows, and flagging tickets that are likely over-prioritised before
        they consume sprint capacity.
      </p>
      <p>
        The output is a ranked list with a written rationale for each call. Not a black box — an
        explanation you can read aloud in sprint planning and defend. When someone asks why the
        CSS bug isn&apos;t in this sprint, you have a documented answer.
      </p>
      <p>
        For PMs running triage on 50+ bugs, the time savings are meaningful. But more than the
        time, the value is consistency. The same scoring rules applied to every ticket, every
        sprint, regardless of who filed it or how loudly they escalated.
      </p>

      {/* ── CTA block ── */}
      <div className="border border-gray-200 bg-gray-50 px-6 py-6 mt-8 space-y-3">
        <p className="font-semibold text-black" style={HEAD}>Ready to see what your backlog actually looks like?</p>
        <p className="text-sm">
          Export your Jira or Linear backlog as a CSV and run it through SenseBug AI.
          The Starter plan is free — 50 bugs, no credit card required.
          The checkout bug that&apos;s been quietly filed as P3 is in there somewhere.
        </p>
        <Link
          href="/signup"
          className="inline-block bg-black text-white px-6 py-2.5 text-sm font-semibold hover:bg-black/85 transition-colors duration-150 mt-1"
        >
          Triage my backlog — it&apos;s free
        </Link>
      </div>

    </article>
  )
}
