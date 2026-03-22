'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// F5: Client-side redirect (was server-side `redirect()` which caused a hard navigation,
// unmounting the ChatProvider and losing in-flight SSE streams).
export default function ProfilePage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/profile/cartella')
  }, [router])
  return null
}
