import ProtectedRoute from '../../src/components/ProtectedRoute'
import SubscriptionPage from '../../src/pages/SubscriptionPage'

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['tutor']}>
      <SubscriptionPage />
    </ProtectedRoute>
  )
}
