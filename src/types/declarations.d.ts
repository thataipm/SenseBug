// Type declarations for non-TypeScript module imports

// Allow side-effect CSS imports (e.g. import './globals.css')
declare module '*.css'

// Google Analytics gtag global
interface Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gtag: (...args: any[]) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataLayer: any[]
}
