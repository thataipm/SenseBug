import type { Metadata } from 'next'
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
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
  metadataBase: new URL('https://www.sensebug.com'),
  title: 'SenseBug AI | AI Bug Prioritization for Product Managers',
  description: 'AI-powered bug triage and prioritization for Product Managers. Upload your Jira or Linear backlog and get a ranked list by business impact in seconds.',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    siteName: 'SenseBug AI',
    type: 'website',
    locale: 'en_US',
    url: 'https://www.sensebug.com',
    title: 'SenseBug AI | Every bug priority decision, justified.',
    description: 'AI-powered bug triage for Product Managers. Upload your backlog and get a ranked list by business impact — with a written rationale for every call.',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@sensebugai',
    title: 'SenseBug AI | Every bug priority decision, justified.',
    description: 'AI-powered bug triage for Product Managers. Upload your backlog and get a ranked list by business impact — with a written rationale for every call.',
  },
}

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SenseBug AI',
  url: 'https://www.sensebug.com',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'AI-powered bug triage and prioritization for Product Managers. Ranks every bug by business impact and provides a written rationale for every call.',
  offers: [
    { '@type': 'Offer', name: 'Starter', price: '0',  priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Pro',     price: '19', priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Max',     price: '49', priceCurrency: 'USD' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} bg-white text-black antialiased`}
        style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  )
}
