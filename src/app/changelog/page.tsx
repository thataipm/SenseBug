export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      <header className="border-b border-gray-200 px-6 md:px-12 py-4 flex items-center justify-between">
        <a href="/" className="font-black text-lg tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>SENSEBUG AI</a>
        <a href="/dashboard" className="text-sm text-black/50 hover:text-black transition-colors duration-150">Dashboard →</a>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-20">
        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Changelog</p>
        <h1 className="text-4xl font-black tracking-tighter mb-3" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>What&apos;s new</h1>
        <p className="text-sm text-black/50 mb-16">Product updates, fixes, and improvements.</p>

        <div data-testid="changelog-empty" className="border border-dashed border-gray-200 py-16 text-center">
          <p className="text-sm text-black/35 font-mono" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>No updates published yet.</p>
        </div>
      </main>
    </div>
  )
}
