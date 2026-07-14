import ProtectedRoute from '../../src/components/ProtectedRoute'
import BookingPage from '../../src/pages/BookingPage'

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['tutor', 'parent']}>
      <BookingPage />
    </ProtectedRoute>
  )
}
