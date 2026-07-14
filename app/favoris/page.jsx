import ProtectedRoute from '../../src/components/ProtectedRoute'
import FavoritesPage from '../../src/views/FavoritesPage'

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['parent']}>
      <FavoritesPage />
    </ProtectedRoute>
  )
}
