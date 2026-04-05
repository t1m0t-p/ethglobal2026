'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Types ──────────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'active' | 'complete'

interface TimelineStep {
  id: string
  title: string
  description: string
  techDetail: string
  icon: string
  activeStates: string[]
  completeWhen: string[]
}

const STEPS: TimelineStep[] = [
  {
    id: 'publish',
    title: 'Task Published to HCS',
    description: 'Your bounty is immutably recorded on Hedera Consensus Service.',
    techDetail: 'HCS topic message · on-chain timestamp',
    icon: '📡',
    activeStates: ['IDLE', 'POSTING', 'submitted'],
    completeWhen: ['AWAITING_BIDS', 'ESCROWING', 'AWAITING_RESULTS', 'COMPLETED', 'awaiting_bids'],
  },
  {
    id: 'bids',
    title: 'Workers Discovering & Bidding',
    description: 'Autonomous agents scan HCS and submit competitive bids.',
    techDetail: 'BidMessage · workerId · bidAmount',
    icon: '🤖',
    activeStates: ['AWAITING_BIDS', 'awaiting_bids'],
    completeWhen: ['ESCROWING', 'AWAITING_RESULTS', 'COMPLETED'],
  },
  {
    id: 'escrow',
    title: 'Escrow Locked',
    description: 'HBAR reward locked in a Hedera Scheduled Transaction — no central custody.',
    techDetail: 'ScheduleCreateTransaction · HBAR locked',
    icon: '🔐',
    activeStates: ['ESCROWING'],
    completeWhen: ['AWAITING_RESULTS', 'COMPLETED'],
  },
  {
    id: 'execute',
    title: 'Agents Executing Task',
    description: 'Workers fetch data via x402 pay-per-request and submit results on HCS.',
    techDetail: 'x402 protocol · ResultMessage · multi-source',
    icon: '⚡',
    activeStates: ['AWAITING_RESULTS'],
    completeWhen: ['COMPLETED'],
  },
  {
    id: 'verdict',
    title: 'Verdict & Payment Released',
    description: 'Judge evaluates submissions, posts verdict on HCS, and releases HBAR on-chain.',
    techDetail: 'VerdictMessage · ScheduleSignTransaction',
    icon: '⚖️',
    activeStates: ['COMPLETED'],
    completeWhen: [],
  },
]

// ── Demo mode progression ──────────────────────────────────────────────────

const DEMO_STATES = [
  'IDLE',
  'POSTING',
  'AWAITING_BIDS',
  'ESCROWING',
  'AWAITING_RESULTS',
  'COMPLETED',
]

// ── Helpers ────────────────────────────────────────────────────────────────

function getStepStatus(step: TimelineStep, currentState: string): StepStatus {
  if (step.completeWhen.includes(currentState)) return 'complete'
  if (step.activeStates.includes(currentState)) return 'active'
  return 'pending'
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StepIcon({ status, icon }: { status: StepStatus; icon: string }) {
  return (
    <div className="relative flex-shrink-0">
      {/* Pulsing ring for active state */}
      {status === 'active' && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: 'rgba(139,191,159,0.25)' }}
          animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <div
        className={`relative w-12 h-12 rounded-full flex items-center justify-center text-xl border-2 transition-all duration-500 ${
          status === 'complete'
            ? 'bg-mint-light border-mint-dark text-mint-deeper'
            : status === 'active'
            ? 'bg-mint-light border-mint text-2xl shadow-md'
            : 'bg-white border-charcoal/10 text-charcoal/30 grayscale'
        }`}
      >
        {status === 'complete' ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            ✓
          </motion.span>
        ) : (
          icon
        )}
      </div>
    </div>
  )
}

function ConnectorLine({ filled }: { filled: boolean }) {
  return (
    <div className="flex justify-center w-12 flex-shrink-0">
      <div className="w-0.5 h-8 bg-charcoal/10 relative overflow-hidden">
        <motion.div
          className="absolute top-0 left-0 right-0 bg-mint"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: filled ? 1 : 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ originY: 0, height: '100%' }}
        />
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

interface Props {
  taskId: string | null
  demoMode: boolean
  apiBase: string
}

export default function TaskTimeline({ taskId, demoMode, apiBase }: Props) {
  const [currentState, setCurrentState] = useState<string>('IDLE')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const demoRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Elapsed time counter
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Real polling
  useEffect(() => {
    if (!taskId || demoMode) return

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/api/status/${taskId}`)
        if (!res.ok) return
        const data = await res.json()
        setCurrentState(data.state ?? 'IDLE')
        if (data.state === 'COMPLETED' || data.state === 'ERROR') {
          if (pollRef.current) clearInterval(pollRef.current)
        }
      } catch {
        // silently ignore poll errors
      }
    }, 2000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [taskId, demoMode, apiBase])

  // Demo mode auto-advance
  useEffect(() => {
    if (!demoMode) return

    let idx = 0
    setCurrentState(DEMO_STATES[0])

    const advance = () => {
      idx++
      if (idx < DEMO_STATES.length) {
        setCurrentState(DEMO_STATES[idx])
        demoRef.current = setTimeout(advance, 2500)
      }
    }
    demoRef.current = setTimeout(advance, 1500)

    return () => {
      if (demoRef.current) clearTimeout(demoRef.current)
    }
  }, [demoMode])

  const isComplete = currentState === 'COMPLETED'

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-charcoal text-lg">Task Lifecycle</h3>
          <p className="text-charcoal/50 text-xs mt-0.5">
            {demoMode ? 'Demo mode — simulating agent flow' : `Polling every 2s · ${elapsedSeconds}s elapsed`}
          </p>
        </div>
        {demoMode && (
          <span className="bg-amber-50 text-amber-600 border border-amber-200 text-xs font-bold px-3 py-1 rounded-full">
            DEMO
          </span>
        )}
        {!demoMode && taskId && (
          <span className="bg-mint-light text-mint-deeper border border-mint/30 text-xs font-mono px-3 py-1 rounded-full truncate max-w-[160px]">
            {taskId}
          </span>
        )}
      </div>

      {/* Steps */}
      {STEPS.map((step, i) => {
        const status = getStepStatus(step, currentState)
        const isLast = i === STEPS.length - 1

        return (
          <div key={step.id}>
            <motion.div
              className="flex gap-4 items-start"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
            >
              <StepIcon status={status} icon={step.icon} />

              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`font-bold text-sm transition-colors duration-300 ${
                      status === 'pending' ? 'text-charcoal/30' : 'text-charcoal'
                    }`}
                  >
                    {step.title}
                  </span>

                  <AnimatePresence mode="wait">
                    {status === 'active' && (
                      <motion.span
                        key="active-badge"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="text-xs bg-mint text-white font-semibold px-2 py-0.5 rounded-full"
                      >
                        In progress…
                      </motion.span>
                    )}
                    {status === 'complete' && (
                      <motion.span
                        key="done-badge"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-xs bg-mint-light text-mint-deeper font-semibold px-2 py-0.5 rounded-full"
                      >
                        Done ✓
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <p
                  className={`text-xs mt-0.5 transition-colors duration-300 ${
                    status === 'pending' ? 'text-charcoal/25' : 'text-charcoal/55'
                  }`}
                >
                  {step.description}
                </p>

                {status !== 'pending' && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="text-xs font-mono text-mint-deeper/70 mt-1"
                  >
                    {step.techDetail}
                  </motion.p>
                )}
              </div>
            </motion.div>

            {!isLast && (
              <ConnectorLine filled={status === 'complete'} />
            )}
          </div>
        )
      })}

      {/* Completion card */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 bg-mint-light border border-mint/40 rounded-2xl p-5 text-center"
          >
            <div className="text-3xl mb-2">🎉</div>
            <p className="font-bold text-mint-deeper text-sm">Task complete!</p>
            <p className="text-charcoal/50 text-xs mt-1">
              HBAR released to the winning agent on-chain.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
