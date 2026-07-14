import ProtectedRoute from '../../src/components/ProtectedRoute'
import SubscriptionPage from '../../src/views/SubscriptionPage'

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['tutor']}>
      <SubscriptionPage />
    </ProtectedRoute>
  )
}
