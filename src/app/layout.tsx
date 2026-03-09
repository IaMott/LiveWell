import type { ReactNode } from 'react'
import './globals.css'
import { SettingsApplier } from '@/components/settings/SettingsApplier'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>
        <SettingsApplier />
        {children}
      </body>
    </html>
  )
}
