import ProtectedRoute from '../../../src/components/ProtectedRoute'
import RecruitPage from '../../../src/views/RecruitPage'

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['parent']}>
      <RecruitPage />
    </ProtectedRoute>
  )
}
