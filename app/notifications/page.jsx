import ProtectedRoute from '../../src/components/ProtectedRoute'
import NotificationsPage from '../../src/views/NotificationsPage'

export default function Page() {
  return (
    <ProtectedRoute>
      <NotificationsPage />
    </ProtectedRoute>
  )
}
