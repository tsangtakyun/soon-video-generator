import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SOON · 影片生成器',
  description: 'AI 影片 Prompt 生成及影片生成系統',
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
