'use client'
import Link from 'next/link'

type ActivePage = 'dashboard' | 'history' | 'account' | 'settings' | 'other'

interface AppHeaderProps {
  activePage: ActivePage
  rightSlot?: React.ReactNode
}

export function AppHeader({ activePage, rightSlot }: AppHeaderProps) {
  const links: { href: string; key: ActivePage; label: string }[] = [
    { href: '/dashboard', key: 'dashboard', label: 'Dashboard' },
    { href: '/historyRun', key: 'history', label: 'History' },
    { href: '/account', key: 'account', label: 'Account' },
    { href: '/settings', key: 'settings', label: 'Settings' },
  ]

  return (
    <header className="border-b border-gray-200 px-6 md:px-12 py-4 flex items-center justify-between" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      <div className="flex items-center gap-8">
        <Link href="/dashboard" className="font-black text-lg tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
          SENSEBUG AI
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          {links.map(({ href, key, label }) => (
            <Link
              key={key}
              href={href}
              className={`text-sm transition-colors duration-150 ${
                activePage === key
                  ? 'font-medium text-black border-b-2 border-black pb-0.5'
                  : 'text-black/50 hover:text-black'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <a href="/#faq" className="text-xs text-black/35 hover:text-black transition-colors duration-150 hidden md:block">Help</a>
        {rightSlot}
      </div>
    </header>
  )
}
