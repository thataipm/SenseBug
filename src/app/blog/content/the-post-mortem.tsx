import Link from 'next/link'

const MONO = { fontFamily: 'var(--font-ibm-plex-mono), monospace' }
const HEAD = { fontFamily: 'var(--font-space-grotesk), sans-serif' }

export default function ThePostMortem() {
  return (
    <article className="space-y-6 text-black/75 leading-relaxed" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>

      <p className="text-lg text-black/80 leading-relaxed font-medium">
        It happened on a Thursday. A payment failure bug had been sitting in the backlog for
        three weeks, marked P3 by a QA engineer who noted it only happened &ldquo;sometimes on
        mobile.&rdquo; By the time someone connected it to a 14% drop in checkout completions,
        three sprints had gone by. The post-mortem was scheduled for the following Monday.
      </p>

      <p>
        Every PM in a room of engineers, a head of product, and a CEO asking one question:
        &ldquo;Why didn&apos;t we catch this?&rdquo;
      </p>

      <p>
        The honest answer — &ldquo;we trusted the reporter&apos;s priority label&rdquo; — is
        also the most damaging one you can give.
      </p>

      {/* ── Section 1 ── */}
      <h2 className="text-2xl font-black tracking-tight pt-4" style={HEAD}>
        The Real Cost of a Missed Critical Bug
      </h2>

      <p>
        When a critical bug slips through triage, the immediate cost is visible: revenue lost,
        users churned, engineering time spent on an emergency fix. But the secondary cost is the
        one that lingers.
      </p>

      <p>You lose credibility as the person responsible for deciding what gets fixed.</p>

      <p>
        The question at the post-mortem is never really about the bug. It&apos;s about whether
        your process can be trusted — whether the next critical issue will also sit in the backlog
        for three weeks while the team ships CSS tweaks.
      </p>

      <p>
        That question doesn&apos;t go away after one post-mortem. It follows you into every sprint
        planning meeting. Every time you deprioritise something, someone in the room is wondering
        whether you missed another one.
      </p>

      {/* ── Section 2 ── */}
      <h2 className="text-2xl font-black tracking-tight pt-4" style={HEAD}>
        Why Bugs Get Mislabelled in the First Place
      </h2>

      <p>
        The payment bug was filed by a QA engineer who genuinely believed it was intermittent and
        low-impact. They weren&apos;t wrong based on what they saw. They just didn&apos;t have the
        full picture: which user segment was affected, which device share represented &ldquo;sometimes
        on mobile,&rdquo; which flow the bug lived in.
      </p>

      <p>
        This is the structural problem with reporter-assigned priority. The person filing the bug
        has the narrowest view of it. They can describe the symptom accurately. They cannot
        accurately judge the business consequence.
      </p>

      <div className="space-y-4 pl-4 border-l-2 border-gray-200">
        <div>
          <p className="font-semibold text-black">QA engineers</p>
          <p className="text-sm mt-1">
            File priority based on technical severity. A data corruption bug gets Critical.
            A payment failure on one browser gets Medium. These are different scales.
          </p>
        </div>
        <div>
          <p className="font-semibold text-black">Customer success teams</p>
          <p className="text-sm mt-1">
            File priority based on how loudly the customer complained. One enterprise account
            reports a cosmetic issue — it&apos;s filed as P1. A silent bug affecting 200 self-serve
            users goes unnoticed.
          </p>
        </div>
        <div>
          <p className="font-semibold text-black">Engineers</p>
          <p className="text-sm mt-1">
            File priority based on what they find interesting to fix, or what&apos;s technically
            elegant. Neither of these correlates with business impact.
          </p>
        </div>
      </div>

      <p>
        By the time the bug reaches your backlog, its priority label reflects the perspective and
        incentives of whoever filed it — not the actual risk to your product.
      </p>

      {/* ── Section 3 ── */}
      <h2 className="text-2xl font-black tracking-tight pt-4" style={HEAD}>
        What &ldquo;Defensible&rdquo; Triage Actually Means
      </h2>

      <p>
        A defensible prioritisation decision is one where, if someone asks you why you made it,
        you have a documented answer that doesn&apos;t start with &ldquo;I felt like&rdquo; or
        &ldquo;the reporter said.&rdquo;
      </p>

      <p>It means being able to say:</p>

      <div className="border border-gray-200 bg-gray-50 px-6 py-5 space-y-2 text-sm">
        <p>&ldquo;This bug was ranked P3 because it affected a non-critical settings flow,
          a workaround existed, and no revenue path was impacted based on the description.&rdquo;</p>
        <p className="text-black/40 text-xs" style={MONO}>— A documented rationale</p>
      </div>

      <p>
        That sentence does three things. It shows your reasoning was grounded in product context,
        not gut feel. It creates a paper trail if the decision is later questioned. And it surfaces
        the gap: if the bug description was missing the information that would have changed the
        verdict, that&apos;s a process failure in how bugs are filed — not a triage failure.
      </p>

      <p>
        Defensible triage isn&apos;t about being right every time. It&apos;s about being able to
        show your work — so that when something does slip through, the conversation is about
        improving the system, not about whether you can be trusted.
      </p>

      {/* ── Section 4 ── */}
      <h2 className="text-2xl font-black tracking-tight pt-4" style={HEAD}>
        The Conversation That Changes Everything
      </h2>

      <p>
        There are two versions of the post-mortem conversation.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-gray-200 p-5">
          <p className="text-xs font-mono uppercase tracking-widest text-black/30 mb-4" style={MONO}>
            Version A — no documented rationale
          </p>
          <div className="space-y-3 text-sm">
            <p><span className="font-semibold">CEO:</span> Why was this P3?</p>
            <p><span className="font-semibold">PM:</span> The QA engineer who filed it said it was intermittent.</p>
            <p><span className="font-semibold">CEO:</span> Did you review it?</p>
            <p><span className="font-semibold">PM:</span> I trusted the label.</p>
            <p className="text-black/40 italic">This is the conversation that follows you.</p>
          </div>
        </div>
        <div className="border border-black p-5">
          <p className="text-xs font-mono uppercase tracking-widest text-black/30 mb-4" style={MONO}>
            Version B — documented rationale
          </p>
          <div className="space-y-3 text-sm">
            <p><span className="font-semibold">CEO:</span> Why was this P3?</p>
            <p><span className="font-semibold">PM:</span> The AI ranked it P3 because the description mentioned no revenue flow. The mobile Safari detail wasn&apos;t flagged as checkout-specific. Here&apos;s the rationale.</p>
            <p><span className="font-semibold">CEO:</span> How do we improve the filing process?</p>
            <p className="text-black/40 italic">This is a system conversation, not a blame conversation.</p>
          </div>
        </div>
      </div>

      <p>
        Version B doesn&apos;t require the AI to have been right. It requires the AI to have had
        a documented reason — one that shows the decision was made on available information, not
        on someone&apos;s intuition.
      </p>

      {/* ── Section 5 ── */}
      <h2 className="text-2xl font-black tracking-tight pt-4" style={HEAD}>
        Building a Triage Process You Can Stand Behind
      </h2>

      <div className="space-y-4">
        {[
          {
            step: 'Step 1',
            title: 'Ignore the priority label when you read the ticket',
            body: 'The label was set by someone with a different definition of urgent. Read the description, the comments, the affected flow — then form your own view.',
          },
          {
            step: 'Step 2',
            title: 'Map every bug to your critical flows',
            body: 'What are the 4–6 flows in your product that, if broken, hurt revenue or users directly? Checkout, onboarding, billing, core product loop. Any bug touching one of these gets elevated attention regardless of its filed label.',
          },
          {
            step: 'Step 3',
            title: 'Write the rationale before you set the priority',
            body: 'Thirty words. Why is this P1? Why is this P3? If you can\'t write it, you haven\'t decided — you\'ve guessed. The rationale is the proof of work.',
          },
          {
            step: 'Step 4',
            title: 'Document disagreements explicitly',
            body: 'When you override a reporter\'s P1 to P3, note it. "Downgraded from P1 — affects non-critical settings flow, workaround exists, no revenue impact evident." That note is your insurance.',
          },
          {
            step: 'Step 5',
            title: 'Treat missing information as a signal, not a blocker',
            body: 'A bug with no repro steps, no affected user count, and a vague description cannot be accurately prioritised. Flag it. Ask for more context. Don\'t guess your way to P1.',
          },
        ].map((s, i) => (
          <div key={i} className="border border-gray-100 p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-black/35 mb-1" style={MONO}>{s.step}</p>
            <p className="font-semibold text-black mb-1.5" style={HEAD}>{s.title}</p>
            <p className="text-sm">{s.body}</p>
          </div>
        ))}
      </div>

      {/* ── Section 6 ── */}
      <h2 className="text-2xl font-black tracking-tight pt-4" style={HEAD}>
        What You Want to Be Able to Say Next Monday
      </h2>

      <p>
        The post-mortem you want to give is one where the question &ldquo;why didn&apos;t we catch
        this?&rdquo; has a complete answer. Not &ldquo;we didn&apos;t know,&rdquo; but: &ldquo;the
        description didn&apos;t include the checkout context — here&apos;s how we change the filing
        process to surface that next time.&rdquo;
      </p>

      <p>
        That answer is only possible if your triage decisions are documented. Every verdict written
        down, every rationale saved, every override noted. Not because you&apos;re covering yourself
        — but because that documentation is what lets you improve the system instead of
        relitigating who was responsible.
      </p>

      <p>
        The goal isn&apos;t a perfect backlog. It&apos;s a defensible one.
      </p>

      {/* ── CTA block ── */}
      <div className="border border-gray-200 bg-gray-50 px-6 py-6 mt-8 space-y-3">
        <p className="font-semibold text-black" style={HEAD}>Every SenseBug verdict comes with a written rationale.</p>
        <p className="text-sm">
          When someone asks why a bug was ranked P3, you have a documented answer — grounded in your
          product&apos;s critical flows, not in whoever filed it. The Starter plan is free for 50 bugs.
        </p>
        <Link
          href="/signup"
          className="inline-block bg-black text-white px-6 py-2.5 text-sm font-semibold hover:bg-black/85 transition-colors duration-150 mt-1"
        >
          Make my triage defensible — it&apos;s free
        </Link>
      </div>

    </article>
  )
}
