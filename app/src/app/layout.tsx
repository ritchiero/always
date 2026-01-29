import type { Metadata } from 'next'
import '../styles/globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { MobileWrapper } from '@/components/MobileWrapper'

export const metadata: Metadata = {
  title: 'Always - Continuous Recording App',
  description: 'Continuous recording app with AI transcription',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <MobileWrapper>
            {children}
          </MobileWrapper>
        </AuthProvider>
      </body>
    </html>
  )
}
