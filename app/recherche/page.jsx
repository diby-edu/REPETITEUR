import { Suspense } from 'react'
import SearchPage from '../../src/views/SearchPage'

export default function Page() {
  return (
    <Suspense>
      <SearchPage />
    </Suspense>
  )
}
