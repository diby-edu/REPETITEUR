import ProtectedRoute from '../../src/components/ProtectedRoute'
import MessagingPage from '../../src/views/MessagingPage'

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['tutor', 'parent']}>
      <MessagingPage />
    </ProtectedRoute>
  )
}
