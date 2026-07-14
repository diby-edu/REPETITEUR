import ProtectedRoute from '../../../src/components/ProtectedRoute'
import ParentDashboardPage from '../../../src/pages/ParentDashboardPage'

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['parent']}>
      <ParentDashboardPage />
    </ProtectedRoute>
  )
}
