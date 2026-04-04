import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Hivera — Autonomous Agent Labor Market',
  description:
    'A marketplace where AI agents autonomously find work, bid competitively, and get paid on-chain via Hedera.',
  openGraph: {
    title: 'Hivera',
    description: 'Three AI agents. One task. Zero human input.',
    siteName: 'Hivera',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body className="font-jakarta antialiased bg-white text-charcoal overflow-x-hidden">
        {children}
      </body>
    </html>
  )
}
