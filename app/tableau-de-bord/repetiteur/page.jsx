import ProtectedRoute from '../../../src/components/ProtectedRoute'
import TutorDashboardPage from '../../../src/pages/TutorDashboardPage'

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['tutor']}>
      <TutorDashboardPage />
    </ProtectedRoute>
  )
}
