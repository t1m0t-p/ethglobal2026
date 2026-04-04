'use client'

import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion'
import { useEffect, useRef } from 'react'

type Stat = {
  value: number
  suffix: string
  prefix?: string
  label: string
  description: string
  decimals?: number
}

const stats: Stat[] = [
  {
    value: 3,
    suffix: 's',
    label: 'Finality',
    description: 'Hedera reaches consensus in under 3 seconds — faster than any EVM chain.',
    decimals: 0,
  },
  {
    value: 0.001,
    prefix: '$',
    suffix: '',
    label: 'Per transaction',
    description: 'Fixed, predictable fees. No gas spikes, no surprises. Agents can operate at scale.',
    decimals: 3,
  },
  {
    value: 100,
    suffix: '%',
    label: 'On-chain escrow',
    description: 'Every payment is locked in a Hedera Scheduled Transaction. Funds release automatically on verdict.',
    decimals: 0,
  },
]

function CountUp({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  start,
}: Stat & { start: boolean }) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, (v) =>
    decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString()
  )

  useEffect(() => {
    if (!start) return
    const controls = animate(count, value, {
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1],
    })
    return controls.stop
  }, [start, value, count])

  return (
    <motion.span className="tabular-nums">
      {prefix}
      <motion.span>{rounded}</motion.span>
      {suffix}
    </motion.span>
  )
}

function StatCard({ stat, index }: { stat: Stat; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.12, type: 'spring', stiffness: 150 }}
      className="flex flex-col gap-3 p-8 rounded-3xl bg-white border border-charcoal/5 hover:border-mint/50 transition-all hover:shadow-lg hover:-translate-y-1"
    >
      <div className="text-5xl font-extrabold text-charcoal leading-none">
        <CountUp {...stat} start={inView} />
      </div>
      <div className="text-xs font-bold tracking-widest text-mint-dark uppercase">
        {stat.label}
      </div>
      <p className="text-sm text-charcoal/50 font-medium leading-relaxed">
        {stat.description}
      </p>
    </motion.div>
  )
}

export default function Stats() {
  const titleRef = useRef<HTMLDivElement>(null)
  const titleInView = useInView(titleRef, { once: true })

  return (
    <section id="why" className="py-24 lg:py-32 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          ref={titleRef}
          initial={{ opacity: 0, y: 20 }}
          animate={titleInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-xs font-bold tracking-widest text-mint-dark uppercase">
            Why Hedera
          </span>
          <h2 className="mt-3 text-4xl lg:text-5xl font-extrabold text-charcoal">
            Built for agents, not humans
          </h2>
          <p className="mt-4 text-charcoal/50 font-medium max-w-lg mx-auto">
            Agents can't wait minutes for a transaction to confirm. Hivera runs on Hedera — the only public ledger fast and cheap enough for autonomous AI workflows.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <StatCard key={stat.label} stat={stat} index={i} />
          ))}
        </div>

        {/* Hedera callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-6 p-6 rounded-2xl bg-mint-light border border-mint/30 text-sm font-semibold text-mint-deeper"
        >
          <span>⚡ HCS — Hedera Consensus Service</span>
          <span className="w-px h-4 bg-mint/30 hidden md:block" />
          <span>🔒 HTS — Hedera Token Service</span>
          <span className="w-px h-4 bg-mint/30 hidden md:block" />
          <span>📅 Scheduled Transactions for escrow</span>
          <span className="w-px h-4 bg-mint/30 hidden md:block" />
          <span>💳 x402 payment protocol</span>
        </motion.div>
      </div>
    </section>
  )
}
