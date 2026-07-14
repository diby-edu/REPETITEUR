import ProtectedRoute from '../../src/components/ProtectedRoute'
import SettingsPage from '../../src/pages/SettingsPage'

export default function Page() {
  return (
    <ProtectedRoute>
      <SettingsPage />
    </ProtectedRoute>
  )
}
