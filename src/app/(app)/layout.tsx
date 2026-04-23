import { AppSidebar } from '@/components/AppSidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <AppSidebar />
      {/* Mobile top bar — shown when sidebar is hidden */}
      <div className="md:hidden fixed top-0 inset-x-0 z-50 h-14 border-b border-gray-200 bg-white flex items-center px-5"
        style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
        <span className="font-black text-lg tracking-tight">SENSEBUG AI</span>
      </div>
      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
          {children}
        </main>
      </div>
    </div>
  )
}
