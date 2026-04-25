import type { Metadata } from 'next'
import Link from 'next/link'
import { posts, formatDate } from './lib/posts'

export const metadata: Metadata = {
  title: 'Blog — SenseBug AI',
  description: 'Product management insights on bug triage, sprint planning, and getting your engineering team focused on what actually matters.',
  openGraph: {
    title: 'Blog — SenseBug AI',
    description: 'Product management insights on bug triage, sprint planning, and getting your engineering team focused on what actually matters.',
    url: 'https://www.sensebug.com/blog',
    siteName: 'SenseBug AI',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog — SenseBug AI',
    description: 'Product management insights on bug triage, sprint planning, and getting your engineering team focused on what actually matters.',
  },
}

export default function BlogIndex() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>

      {/* Nav */}
      <nav className="border-b border-gray-200 px-6 md:px-12 py-4 flex items-center justify-between sticky top-0 bg-white z-50">
        <Link
          href="/"
          style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
          className="font-black text-xl tracking-tight hover:text-black/70 transition-colors duration-150"
        >
          SENSEBUG AI
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/blog" className="text-sm font-medium text-black transition-colors duration-150 hidden md:block">
            Blog
          </Link>
          <Link href="/pricing" className="text-sm font-medium text-black/50 hover:text-black transition-colors duration-150 hidden md:block">
            Pricing
          </Link>
          <Link href="/login" className="text-sm font-medium text-black/60 hover:text-black transition-colors duration-150">
            Log in
          </Link>
          <Link
            href="/signup"
            className="bg-black text-white text-sm font-semibold px-5 py-2.5 hover:bg-black/90 transition-colors duration-150"
          >
            Try free
          </Link>
        </div>
      </nav>

      {/* Header */}
      <header className="px-6 md:px-12 lg:px-24 py-16 border-b border-gray-200">
        <div className="max-w-3xl">
          <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
            Blog
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
            Insights for product managers<br />who triage bugs.
          </h1>
        </div>
      </header>

      {/* Post list */}
      <main className="px-6 md:px-12 lg:px-24 py-16">
        <div className="max-w-3xl divide-y divide-gray-100">
          {posts.map((post) => (
            <article key={post.slug} className="py-10 first:pt-0">
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="text-xs font-mono uppercase tracking-widest text-black/35"
                  style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
                >
                  {post.category}
                </span>
                <span className="text-black/20 text-xs">·</span>
                <span
                  className="text-xs font-mono text-black/35"
                  style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
                >
                  {formatDate(post.date)}
                </span>
                <span className="text-black/20 text-xs">·</span>
                <span
                  className="text-xs font-mono text-black/35"
                  style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
                >
                  {post.readTime}
                </span>
              </div>
              <h2
                className="text-2xl font-black tracking-tight mb-3 leading-snug"
                style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
              >
                <Link
                  href={`/blog/${post.slug}`}
                  className="hover:text-black/60 transition-colors duration-150"
                >
                  {post.title}
                </Link>
              </h2>
              <p className="text-sm text-black/55 leading-relaxed mb-4">
                {post.description}
              </p>
              <Link
                href={`/blog/${post.slug}`}
                className="text-sm font-semibold text-black hover:text-black/55 transition-colors duration-150"
              >
                Read article →
              </Link>
            </article>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 md:px-12 lg:px-24 py-10 border-t border-gray-100 mt-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="font-black text-lg tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
            SENSEBUG AI
          </div>
          <div className="flex items-center gap-6 text-sm text-black/35">
            <Link href="/privacy" className="hover:text-black transition-colors duration-150">Privacy</Link>
            <Link href="/terms" className="hover:text-black transition-colors duration-150">Terms</Link>
            <a href="mailto:contact@sensebug.com" className="hover:text-black transition-colors duration-150">Contact</a>
            <span>© 2026 SenseBug AI</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
