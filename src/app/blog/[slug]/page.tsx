import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPost, formatDate } from '../lib/posts'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return {}

  return {
    title: `${post.title} — SenseBug AI`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://www.sensebug.com/blog/${post.slug}`,
      siteName: 'SenseBug AI',
      type: 'article',
      publishedTime: post.date,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  }
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  // Dynamically import the content component for this slug
  let Content: React.ComponentType
  try {
    const mod = await import(`../content/${slug}`)
    Content = mod.default
  } catch {
    notFound()
  }

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
          <Link href="/blog" className="text-sm font-medium text-black/50 hover:text-black transition-colors duration-150 hidden md:block">
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

      {/* Article header */}
      <header className="px-6 md:px-12 lg:px-24 py-14 border-b border-gray-200">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-5">
            <Link
              href="/blog"
              className="text-xs font-mono uppercase tracking-widest text-black/35 hover:text-black transition-colors duration-150"
              style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
            >
              ← Blog
            </Link>
            <span className="text-black/20 text-xs">·</span>
            <span
              className="text-xs font-mono uppercase tracking-widest text-black/35"
              style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
            >
              {post.category}
            </span>
          </div>
          <h1
            className="text-4xl md:text-5xl font-black tracking-tighter leading-tight mb-5"
            style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
          >
            {post.title}
          </h1>
          <p className="text-base text-black/55 leading-relaxed mb-6">{post.description}</p>
          <div
            className="flex items-center gap-3 text-xs font-mono text-black/35"
            style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
          >
            <span>{formatDate(post.date)}</span>
            <span>·</span>
            <span>{post.readTime}</span>
          </div>
        </div>
      </header>

      {/* Article body */}
      <main className="px-6 md:px-12 lg:px-24 py-14">
        <div className="max-w-2xl">
          <Content />
        </div>
      </main>

      {/* Back to blog */}
      <div className="px-6 md:px-12 lg:px-24 pb-16">
        <div className="max-w-2xl border-t border-gray-100 pt-10">
          <Link
            href="/blog"
            className="text-sm font-semibold text-black/40 hover:text-black transition-colors duration-150"
          >
            ← Back to all posts
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-6 md:px-12 lg:px-24 py-10 border-t border-gray-100">
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
