import { Suspense } from 'react'
import ProtectedRoute from '../../src/components/ProtectedRoute'
import AdminDashboardPage from '../../src/views/AdminDashboardPage'

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Suspense>
        <AdminDashboardPage />
      </Suspense>
    </ProtectedRoute>
  )
}
