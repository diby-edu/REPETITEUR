import { Suspense } from 'react'
import SearchPage from '../../src/pages/SearchPage'

export default function Page() {
  return (
    <Suspense>
      <SearchPage />
    </Suspense>
  )
}
