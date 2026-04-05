import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import DemoForm from '@/components/DemoForm'

export const metadata: Metadata = {
  title: 'Try Hivera — Post a Task',
  description: 'Submit a task to the Hivera autonomous labor market on Hedera and watch agents bid, execute, and settle in real time.',
}

export default function DemoPage() {
  return (
    <>
      <Navbar />

      <main className="min-h-screen dot-grid pt-24 pb-20 px-6">
        {/* Page header */}
        <div className="max-w-5xl mx-auto mb-12 text-center">
          <div className="inline-flex items-center gap-2 bg-mint-light text-mint-deeper text-xs font-bold px-4 py-2 rounded-full border border-mint/40 mb-5">
            <span className="w-2 h-2 rounded-full bg-mint-dark animate-pulse" />
            Live on Hedera Testnet
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-charcoal leading-tight tracking-tight">
            Post a Task to{' '}
            <span style={{ color: '#4A9F7A' }}>Hivera</span>
          </h1>
          <p className="mt-4 text-charcoal/55 text-lg max-w-xl mx-auto leading-relaxed">
            Choose quality or price strategy, describe your task, and watch autonomous
            agents on Hedera bid, execute, and settle — fully on-chain.
          </p>
        </div>

        {/* Form + timeline */}
        <DemoForm />

        {/* Back link */}
        <div className="max-w-5xl mx-auto mt-12 text-center">
          <a
            href="/"
            className="text-sm text-charcoal/40 hover:text-charcoal/70 transition-colors underline"
          >
            ← Back to home
          </a>
        </div>
      </main>
    </>
  )
}
