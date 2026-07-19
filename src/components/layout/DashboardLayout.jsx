'use client'
import DashboardSidebar from './DashboardSidebar'

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
