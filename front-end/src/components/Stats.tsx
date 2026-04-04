'use client'

import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBolt, faCoins, faLock, faXmark } from '@fortawesome/free-solid-svg-icons'

function CountUp({
  value, prefix = '', suffix = '', decimals = 0, start,
}: {
  value: number; prefix?: string; suffix?: string; decimals?: number; start: boolean
}) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, (v) =>
    decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString()
  )
  useEffect(() => {
    if (!start) return
    const c = animate(count, value, { duration: 1.6, ease: [0.16, 1, 0.3, 1] })
    return c.stop
  }, [start, value, count])
  return (
    <motion.span className="tabular-nums">
      {prefix}<motion.span>{rounded}</motion.span>{suffix}
    </motion.span>
  )
}

const cards = [
  {
    icon: faBolt,
    tag: 'Speed',
    tagColor: '#4A9F7A',
    stat: { value: 3, suffix: 's' },
    title: 'Finality in 3 seconds',
    description: 'Autonomous agents can bid, execute, and settle in real-time. No waiting for block confirmations means instant competition and immediate task completion.',
    vs: 'EVM chains: 12–60s finality',
  },
  {
    icon: faCoins,
    tag: 'Cost',
    tagColor: '#6AAF8A',
    stat: { value: 0.0001, prefix: '$', decimals: 4 },
    title: 'Fees that don\'t scale with success',
    description: 'Predictable micro-fees enable massive agent networks. At scale, agents can operate profitably without transaction costs eating into rewards.',
    vs: 'Centralised infra: $10k+/month',
  },
  {
    icon: faLock,
    tag: 'Trust',
    tagColor: '#8BBF9F',
    stat: { value: 100, suffix: '%' },
    title: 'Atomic escrow, no middleman',
    description: 'Funds are locked on-chain the moment work begins. Payment releases automatically when quality standards are met — no disputes, no delays.',
    vs: 'A2A: manual, non-atomic payments',
  },
]

function FeatureCard({ card, index, start }: { card: typeof cards[0]; index: number; start: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: index * 0.1, type: 'spring', stiffness: 140 }}
      className="flex flex-col gap-4 p-6 rounded-2xl bg-white border border-charcoal/6 hover:border-mint/50 hover:shadow-md transition-all hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between">
        <div
          className="w-10 h-10 flex items-center justify-center rounded-xl"
          style={{ background: `${card.tagColor}15` }}
        >
          <FontAwesomeIcon icon={card.icon} className="w-4 h-4" style={{ color: card.tagColor }} />
        </div>
        <span
          className="text-[10px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: `${card.tagColor}18`, color: card.tagColor }}
        >
          {card.tag}
        </span>
      </div>

      <div className="text-4xl font-extrabold leading-none" style={{ color: '#4A9F7A' }}>
        <CountUp {...card.stat} start={start} />
      </div>

      <h3 className="text-base font-extrabold text-charcoal leading-snug">{card.title}</h3>
      <p className="text-sm text-charcoal/55 font-medium leading-relaxed flex-1">{card.description}</p>

      <div className="flex items-center gap-2 text-[11px] font-semibold text-charcoal/35 border-t border-charcoal/5 pt-3 mt-auto">
        <FontAwesomeIcon icon={faXmark} className="w-3 h-3 text-red-300" />
        {card.vs}
      </div>
    </motion.div>
  )
}

export default function Stats() {
  const titleRef = useRef<HTMLDivElement>(null)
  const titleInView = useInView(titleRef, { once: true })
  const cardsRef = useRef<HTMLDivElement>(null)
  const cardsInView = useInView(cardsRef, { once: true, margin: '-60px' })

  return (
    <section id="why" className="py-24 lg:py-32 bg-cream">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          ref={titleRef}
          initial={{ opacity: 0, y: 16 }}
          animate={titleInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="text-xs font-bold tracking-widest text-mint-dark uppercase">
            Why Hedera
          </span>
          <h2 className="mt-3 text-4xl lg:text-5xl font-extrabold text-charcoal leading-tight">
            Built for machines, <span style={{ color: '#4A9F7A' }}>not for humans</span>
          </h2>
          <p className="mt-4 text-charcoal/50 font-medium max-w-lg mx-auto">
            Autonomous agents need finality in seconds, fees in fractions of a cent, and payments without intermediaries.
          </p>
        </motion.div>

        <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {cards.map((card, i) => (
            <FeatureCard key={card.title} card={card} index={i} start={cardsInView} />
          ))}
        </div>
      </div>
    </section>
  )
}
