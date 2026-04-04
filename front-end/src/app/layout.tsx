import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, DM_Serif_Display } from 'next/font/google'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
})

const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
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
    <html lang="en" className={`${plusJakartaSans.variable} ${dmSerifDisplay.variable}`}>
      <body className="font-jakarta antialiased bg-white text-charcoal overflow-x-hidden">
        {children}
      </body>
    </html>
  )
}
