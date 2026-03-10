import type { ReactNode } from 'react'
import { MoodProvider } from '@/components/mood/MoodProvider'
import './globals.css'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>
        <MoodProvider>{children}</MoodProvider>
      </body>
    </html>
  )
}
