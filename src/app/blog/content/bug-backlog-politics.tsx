import Link from 'next/link'

const MONO = { fontFamily: 'var(--font-ibm-plex-mono), monospace' }
const HEAD = { fontFamily: 'var(--font-space-grotesk), sans-serif' }

export default function BugBacklogPolitics() {
  return (
    <article className="space-y-6 text-black/75 leading-relaxed" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>

      <p className="text-lg text-black/80 leading-relaxed font-medium">
        If you&apos;ve ever walked out of sprint planning feeling like you just lost a negotiation
        rather than made a product decision, you&apos;re not imagining it. Bug prioritisation in
        most companies isn&apos;t a technical process. It&apos;s a political one — and most PMs
        are losing it without realising that&apos;s what&apos;s happening.
      </p>

      {/* ── Section 1 ── */}
      <h2 className="text-2xl font-black tracking-tight pt-4" style={HEAD}>
        How a Bug Gets Its Priority Label
      </h2>

      <p>
        Priority labels are set at the moment a bug is filed. That moment is almost always
        politically loaded.
      </p>

      <p>
        The engineer who found the bug wants it fixed — so they file it P1. The sales rep whose
        customer reported an issue marks it Critical because their renewal depends on it. The QA
        tester who found ten bugs this week marks them all High because they want their work to
        look significant. The intern marks everything Medium because they don&apos;t want to
        overstate.
      </p>

      <p>
        None of these people are lying. They&apos;re reporting their genuine perception of
        urgency. But their perception is shaped by their incentives, not by the product&apos;s
        critical flows.
      </p>

      <p>
        By the time those labels hit your backlog, they reflect the organisational politics
        around the bug — who cares about it, who has leverage, who was loudest — far more than
        they reflect actual business impact.
      </p>

      {/* ── Section 2 ── */}
      <h2 className="text-2xl font-black tracking-tight pt-4" style={HEAD}>
        The Four Political Forces That Distort Your Backlog
      </h2>

      <div className="space-y-5">
        {[
          {
            n: '01',
            title: 'The HiPPO Effect',
            body: 'Highest Paid Person\'s Opinion. When someone senior mentions a bug, it gets escalated — regardless of its actual impact. The VP of Sales mentioned a logo misalignment in a demo? Suddenly it\'s in the sprint. The checkout failure affecting 8% of mobile users? Still P3.',
          },
          {
            n: '02',
            title: 'Escalation as a strategy',
            body: 'Some teams have learned that the way to get bugs fixed is to escalate loudly. CC the CTO. Call it "customer-impacting." Use words like "blocker" and "urgent" regardless of whether either is true. If escalation works, it becomes the default strategy — and your backlog fills with noise.',
          },
          {
            n: '03',
            title: 'The squeaky wheel',
            body: 'One vocal enterprise customer reports a bug with enough emotional energy that your whole customer success team escalates it. Meanwhile, 200 self-serve users are hitting a worse bug silently — they just churn instead of complaining. Your backlog optimises for the complaints you hear, not the impact you can\'t see.',
          },
          {
            n: '04',
            title: 'Recency bias',
            body: 'The bugs filed last week feel more urgent than the ones filed six weeks ago — even if the older ones are more critical. Recency is not urgency. But in a fast-moving team, recent always feels important.',
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
        What This Does to Your Engineering Team
      </h2>

      <p>
        Engineers are remarkably good at noticing when the work they&apos;re given doesn&apos;t
        match what they can observe about the product. When a team consistently ships work
        driven by political priority — fixing the logo for the VP&apos;s demo while the checkout
        bug ages — they notice.
      </p>

      <p>
        The effects compound over time:
      </p>

      <div className="space-y-4 pl-4 border-l-2 border-gray-200">
        <div>
          <p className="font-semibold text-black">Cynicism about the PM role</p>
          <p className="text-sm mt-1">
            When the backlog is obviously political, engineers stop trusting the PM to make real
            decisions. They start working around the process — directly taking on bugs they think
            matter, ignoring the official priority.
          </p>
        </div>
        <div>
          <p className="font-semibold text-black">Sprint planning becomes a negotiation</p>
          <p className="text-sm mt-1">
            If the backlog is political, every sprint planning meeting becomes a chance to argue
            for what your team actually wants to work on. Velocity drops. Energy goes into the
            argument, not the work.
          </p>
        </div>
        <div>
          <p className="font-semibold text-black">Technical debt accelerates</p>
          <p className="text-sm mt-1">
            The real bugs — the ones that affect architectural integrity, the ones that will
            get worse over time — keep getting deprioritised in favour of whatever was escalated
            this week. By the time they can&apos;t be ignored, they&apos;re much more expensive
            to fix.
          </p>
        </div>
      </div>

      {/* ── Section 4 ── */}
      <h2 className="text-2xl font-black tracking-tight pt-4" style={HEAD}>
        Why Data Is the Only Thing That Wins the Argument
      </h2>

      <p>
        You cannot win a political argument with more politics. If someone with seniority wants
        their bug fixed and your counter is &ldquo;I think there are more important things,&rdquo;
        you will lose. Seniority beats opinion.
      </p>

      <p>
        Data is the only counter that holds. Specifically: a documented rationale, grounded in
        your product&apos;s critical flows, that shows why Bug A outranks Bug B in terms of
        business impact.
      </p>

      <p>
        When someone asks &ldquo;why isn&apos;t my bug in this sprint?&rdquo; and your answer is
        &ldquo;it was ranked P4 because it affects a non-critical settings page, a workaround
        exists, and no revenue path is impacted — here&apos;s the written rationale&rdquo; —
        that&apos;s a different conversation from &ldquo;I decided it wasn&apos;t important.&rdquo;
      </p>

      <p>
        The first answer is defensible. The second is just another opinion.
      </p>

      {/* ── Section 5 ── */}
      <h2 className="text-2xl font-black tracking-tight pt-4" style={HEAD}>
        What a De-politicised Backlog Looks Like
      </h2>

      <p>A backlog that&apos;s been evaluated on business impact rather than political weight looks different in three ways:</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-gray-200 mt-2">
        {[
          {
            label: '01',
            heading: 'Revenue-critical bugs are at the top',
            body: 'Not the bugs the VP mentioned. Not the ones the loudest customer reported. The ones that affect checkout, onboarding, billing, and your core product loop — regardless of who filed them.',
          },
          {
            label: '02',
            heading: 'Over-escalated bugs are visible',
            body: 'Bugs that were filed P1 but don\'t touch any critical flow are flagged. Not deleted — visible, with a documented reason why they\'re ranked below where they were filed.',
          },
          {
            label: '03',
            heading: 'Every decision has a receipt',
            body: 'When someone questions a priority call, there\'s a written rationale available immediately. The argument ends faster — not because you\'ve shut it down, but because there\'s nothing left to argue with.',
          },
        ].map((item, i) => (
          <div key={item.label} className={`p-6 bg-white ${i < 2 ? 'md:border-r border-b md:border-b-0 border-gray-200' : ''}`}>
            <div className="text-xs font-mono text-black/25 mb-3" style={MONO}>{item.label}</div>
            <h3 className="text-base font-bold mb-2" style={HEAD}>{item.heading}</h3>
            <p className="text-sm text-black/55 leading-relaxed">{item.body}</p>
          </div>
        ))}
      </div>

      {/* ── Section 6 ── */}
      <h2 className="text-2xl font-black tracking-tight pt-4" style={HEAD}>
        How to Start Depoliticising Your Triage
      </h2>

      <p>
        The shift doesn&apos;t require a process overhaul. It requires one change: every priority
        decision needs a documented rationale that references product context, not reporter
        authority.
      </p>

      <div className="space-y-4">
        {[
          {
            step: 'Immediately',
            body: 'For your next sprint planning, pull your top 10 bugs and write a one-sentence rationale for each: why this priority, in terms of which flows are affected. This is the minimum viable version.',
          },
          {
            step: 'This quarter',
            body: 'Build a canonical list of your product\'s critical flows. 4–8 flows. Share it with QA, engineering, and customer success so bug reporters have a shared framework for "what actually matters." Filing quality improves when reporters know what you\'re looking for.',
          },
          {
            step: 'Ongoing',
            body: 'When you override a reported priority, note it explicitly. "Downgraded from P1 — affects settings page, not checkout. Workaround available." These notes are your institutional memory and your protection when questions come up later.',
          },
        ].map((s, i) => (
          <div key={i} className="flex gap-5">
            <div className="text-xs font-mono text-black/30 whitespace-nowrap mt-0.5 w-20 flex-shrink-0" style={MONO}>{s.step}</div>
            <p className="text-sm">{s.body}</p>
          </div>
        ))}
      </div>

      {/* ── CTA block ── */}
      <div className="border border-gray-200 bg-gray-50 px-6 py-6 mt-8 space-y-3">
        <p className="font-semibold text-black" style={HEAD}>Data wins the argument. SenseBug gives you the data.</p>
        <p className="text-sm">
          Every bug gets a written rationale grounded in your product&apos;s critical flows —
          not in who escalated loudest. The Starter plan is free for 50 bugs, no credit card required.
        </p>
        <Link
          href="/signup"
          className="inline-block bg-black text-white px-6 py-2.5 text-sm font-semibold hover:bg-black/85 transition-colors duration-150 mt-1"
        >
          Depoliticise my backlog — it&apos;s free
        </Link>
      </div>

    </article>
  )
}
