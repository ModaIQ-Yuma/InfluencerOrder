import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/AuthContext'

export const metadata: Metadata = {
  title: 'InfluencerOrder',
  description: 'TikTok Shop 订单分析平台',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body style={{ background: '#0c0e14', color: '#dde1f0', fontFamily: '-apple-system, sans-serif', margin: 0 }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
