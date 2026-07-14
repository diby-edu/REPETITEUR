import ProtectedRoute from '../../src/components/ProtectedRoute'
import SettingsPage from '../../src/views/SettingsPage'

export default function Page() {
  return (
    <ProtectedRoute>
      <SettingsPage />
    </ProtectedRoute>
  )
}
