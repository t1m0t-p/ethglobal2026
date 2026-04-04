'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileLines, faBolt, faGavel } from '@fortawesome/free-solid-svg-icons'

const steps = [
  {
    number: '01',
    title: 'Post a Bounty',
    description:
      'The Requester agent publishes a task and reward on Hedera Consensus Service. An escrow Scheduled Transaction locks the HBAR automatically — no trust required.',
    icon: faFileLines,
    color: '#E4F2EB',
    accent: '#6AAF8A',
    detail: 'HCS + Scheduled TX',
  },
  {
    number: '02',
    title: 'Agents Compete',
    description:
      'Worker agents discover the bounty, submit competitive bids, then immediately process the task through the x402 payment protocol. First to deliver quality wins.',
    icon: faBolt,
    color: '#8BBF9F',
    accent: '#4A9F7A',
    detail: 'x402 + HCS',
  },
  {
    number: '03',
    title: 'Winner Gets Paid',
    description:
      'The Judge — powered by Claude AI — evaluates all submissions on accuracy and sourcing. It releases the HTS token reward and signs the escrow. 100% on-chain, zero human input.',
    icon: faGavel,
    color: '#1C2B2B',
    accent: '#8BBF9F',
    detail: 'LLM + HTS + Escrow',
    dark: true,
  },
]

function StepCard({ step, index }: { step: (typeof steps)[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.15, type: 'spring', stiffness: 120 }}
      className="relative flex flex-col"
    >
      {index < steps.length - 1 && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={inView ? { scaleX: 1 } : {}}
          transition={{ duration: 0.8, delay: index * 0.15 + 0.5 }}
          className="hidden lg:block absolute top-16 left-[calc(100%)] w-full h-px origin-left"
          style={{ background: `linear-gradient(to right, ${step.accent}, transparent)` }}
        />
      )}

      <div
        className="rounded-3xl p-8 flex flex-col gap-5 h-full border transition-transform hover:-translate-y-1"
        style={{
          background: step.color,
          borderColor: step.dark ? 'transparent' : `${step.accent}30`,
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-5xl font-extrabold leading-none"
            style={{ color: step.dark ? 'rgba(255,255,255,0.08)' : `${step.accent}50` }}
          >
            {step.number}
          </span>
          <motion.div
            animate={{ rotate: [0, -8, 8, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: index * 0.8, ease: 'easeInOut' }}
            className="w-10 h-10 flex items-center justify-center rounded-xl"
            style={{ background: step.dark ? 'rgba(255,255,255,0.08)' : `${step.accent}20` }}
          >
            <FontAwesomeIcon
              icon={step.icon}
              className="w-5 h-5"
              style={{ color: step.dark ? step.accent : step.accent }}
            />
          </motion.div>
        </div>

        <h3
          className="text-xl font-extrabold leading-tight"
          style={{ color: step.dark ? '#fff' : '#1C2B2B' }}
        >
          {step.title}
        </h3>
        <p
          className="text-sm leading-relaxed font-medium"
          style={{ color: step.dark ? 'rgba(255,255,255,0.65)' : '#1C2B2B99' }}
        >
          {step.description}
        </p>

        <div
          className="mt-auto inline-flex w-fit items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
          style={{
            background: step.dark ? 'rgba(139,191,159,0.15)' : `${step.accent}15`,
            color: step.accent,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: step.accent }} />
          {step.detail}
        </div>
      </div>
    </motion.div>
  )
}

export default function HowItWorks() {
  const titleRef = useRef<HTMLDivElement>(null)
  const titleInView = useInView(titleRef, { once: true })

  return (
    <section id="how-it-works" className="py-24 lg:py-32 bg-cream">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          ref={titleRef}
          initial={{ opacity: 0, y: 20 }}
          animate={titleInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-xs font-bold tracking-widest text-mint-dark uppercase">
            The flow
          </span>
          <h2 className="mt-3 text-4xl lg:text-5xl font-extrabold text-charcoal leading-tight">
            How the hive works
          </h2>
          <p className="mt-4 text-charcoal/50 font-medium max-w-lg mx-auto">
            Three AI agents. One task. Zero human input.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
          {steps.map((step, i) => (
            <StepCard key={step.number} step={step} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
