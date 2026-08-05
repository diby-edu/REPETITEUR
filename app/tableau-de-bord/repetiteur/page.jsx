import { Suspense } from 'react'
import ProtectedRoute from '../../../src/components/ProtectedRoute'
import TutorDashboardPage from '../../../src/views/TutorDashboardPage'

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['tutor']}>
      <Suspense>
        <TutorDashboardPage />
      </Suspense>
    </ProtectedRoute>
  )
}
