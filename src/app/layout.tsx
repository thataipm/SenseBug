import type { Metadata } from 'next'
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SenseBug AI — AI Bug Prioritization for Product Managers',
  description: 'AI-powered bug triage and prioritization for Product Managers. Upload your Jira or Linear backlog and get a ranked list by business impact in seconds.',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    siteName: 'SenseBug AI',
    type: 'website',
    locale: 'en_US',
    url: 'https://www.sensebug.com',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@sensebugai',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} bg-white text-black antialiased`}
        style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}
      >
        {children}
      </body>
    </html>
  )
}
