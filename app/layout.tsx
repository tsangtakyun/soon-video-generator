import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cold Tell 影片生成',
  description: 'Seedance 2.0 Cold Tell 影片生成工具',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-HK">
      <body>{children}</body>
    </html>
  )
}
