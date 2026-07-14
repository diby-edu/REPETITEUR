import ProtectedRoute from '../../src/components/ProtectedRoute'
import AdminDashboardPage from '../../src/pages/AdminDashboardPage'

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <AdminDashboardPage />
    </ProtectedRoute>
  )
}
