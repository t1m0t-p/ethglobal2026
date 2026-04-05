'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TaskTimeline from './TaskTimeline'

// ── Config ─────────────────────────────────────────────────────────────────

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3100'

const EXAMPLE_PROMPTS = [
  'Fetch the current BTC/USD price from 3 independent sources',
  'Find best Paris → Tokyo flights for July 2026',
  'Compare B2B delivery rates Paris → Berlin, 500 kg pallet',
  'Get ETH gas price estimates from multiple providers',
  'Find cheapest car rental at Nice airport for 3 days',
]

const CATEGORIES = [
  { id: 'crypto-price', label: 'Crypto Price', icon: '₿' },
  { id: 'travel', label: 'Travel', icon: '✈' },
  { id: 'delivery', label: 'Delivery', icon: '📦' },
  { id: 'general', label: 'General', icon: '🌐' },
] as const

type Category = (typeof CATEGORIES)[number]['id']
type Strategy = 'quality' | 'price'
type View = 'form' | 'submitting' | 'tracking'

// ── Strategy descriptions ──────────────────────────────────────────────────

const STRATEGY_INFO: Record<Strategy, { title: string; sub: string; detail: string }> = {
  quality: {
    title: 'Quality',
    sub: 'Best result wins',
    detail: 'Judge selects the most accurate submission — workers compete on data quality.',
  },
  price: {
    title: 'Price',
    sub: 'Cheapest bid wins',
    detail: 'Lowest bidder gets the reward — quality is a tiebreaker.',
  },
}

// ── Strategy Toggle ────────────────────────────────────────────────────────

function StrategyToggle({
  value,
  onChange,
}: {
  value: Strategy
  onChange: (v: Strategy) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold text-charcoal/50 uppercase tracking-widest">
        Strategy
      </label>
      <div
        className="relative flex bg-charcoal/8 rounded-full p-1 w-fit gap-0"
        style={{ background: 'rgba(28,43,43,0.07)' }}
      >
        {(['quality', 'price'] as Strategy[]).map((s) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`relative z-10 px-5 py-2 rounded-full text-sm font-bold transition-colors duration-200 ${
              value === s ? 'text-white' : 'text-charcoal/50 hover:text-charcoal/80'
            }`}
          >
            {value === s && (
              <motion.div
                layoutId="strategyPill"
                className="absolute inset-0 rounded-full bg-charcoal"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative">{s === 'quality' ? 'Quality' : 'Price'}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={value}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="text-xs text-charcoal/50"
        >
          <span className="font-semibold text-charcoal/70">{STRATEGY_INFO[value].sub}</span>
          {' — '}
          {STRATEGY_INFO[value].detail}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

// ── Category Pills ─────────────────────────────────────────────────────────

function CategoryPills({
  value,
  onChange,
}: {
  value: Category
  onChange: (v: Category) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold text-charcoal/50 uppercase tracking-widest">
        Category
      </label>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => onChange(c.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all duration-200 ${
              value === c.id
                ? 'bg-mint-light border-mint text-mint-deeper scale-105'
                : 'bg-white border-charcoal/10 text-charcoal/50 hover:border-mint/50'
            }`}
          >
            <span>{c.icon}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function DemoForm() {
  const [view, setView] = useState<View>('form')
  const [description, setDescription] = useState('')
  const [strategy, setStrategy] = useState<Strategy>('quality')
  const [category, setCategory] = useState<Category>('crypto-price')
  const [reward, setReward] = useState(100)
  const [deadlineMinutes, setDeadlineMinutes] = useState(5)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [demoMode, setDemoMode] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const placeholderIdx = Math.floor(Math.random() * EXAMPLE_PROMPTS.length)

  async function handleSubmit() {
    if (!description.trim()) return
    setView('submitting')
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/api/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, strategy, category, reward, deadlineMinutes }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      const data = await res.json()
      setTaskId(data.taskId)
      setDemoMode(false)
      setView('tracking')
    } catch {
      // API unreachable → demo mode
      setTaskId('demo-task')
      setDemoMode(true)
      setView('tracking')
    }
  }

  function handleReset() {
    setView('form')
    setTaskId(null)
    setDemoMode(false)
    setError(null)
    setDescription('')
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      <AnimatePresence mode="wait">

        {/* ── Form view ── */}
        {view === 'form' && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {/* Left — form fields */}
            <div className="bg-white rounded-3xl border border-charcoal/8 shadow-sm p-8 flex flex-col gap-7">
              <div>
                <h2 className="text-2xl font-extrabold text-charcoal">Post a Task</h2>
                <p className="text-charcoal/50 text-sm mt-1">
                  Describe what you need — agents on Hedera will bid, execute, and deliver.
                </p>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-charcoal/50 uppercase tracking-widest">
                  Task Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={EXAMPLE_PROMPTS[placeholderIdx]}
                  rows={3}
                  className="w-full rounded-2xl border-2 border-charcoal/10 focus:border-mint focus:outline-none px-4 py-3 text-sm text-charcoal placeholder:text-charcoal/30 resize-none transition-colors"
                />
              </div>

              {/* Strategy */}
              <StrategyToggle value={strategy} onChange={setStrategy} />

              {/* Category */}
              <CategoryPills value={category} onChange={setCategory} />

              {/* Reward + deadline in a row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-charcoal/50 uppercase tracking-widest">
                    Reward (HBAR)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={reward}
                    onChange={(e) => setReward(Math.max(1, parseInt(e.target.value) || 1))}
                    className="rounded-2xl border-2 border-charcoal/10 focus:border-mint focus:outline-none px-4 py-2.5 text-sm text-charcoal transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-charcoal/50 uppercase tracking-widest">
                    Deadline (min)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={deadlineMinutes}
                    onChange={(e) => setDeadlineMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                    className="rounded-2xl border-2 border-charcoal/10 focus:border-mint focus:outline-none px-4 py-2.5 text-sm text-charcoal transition-colors"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                  {error}
                </p>
              )}

              {/* Submit */}
              <motion.button
                onClick={handleSubmit}
                disabled={!description.trim()}
                whileHover={{ scale: description.trim() ? 1.02 : 1 }}
                whileTap={{ scale: description.trim() ? 0.97 : 1 }}
                className={`w-full py-4 rounded-full font-bold text-sm transition-all duration-200 ${
                  description.trim()
                    ? 'bg-charcoal text-white hover:bg-mint-deeper cursor-pointer'
                    : 'bg-charcoal/10 text-charcoal/30 cursor-not-allowed'
                }`}
              >
                Post to Hivera Network →
              </motion.button>

              <p className="text-center text-xs text-charcoal/30">
                No backend running?{' '}
                <button
                  onClick={() => {
                    setDescription(description || EXAMPLE_PROMPTS[0])
                    setDemoMode(true)
                    setTaskId('demo-task')
                    setView('tracking')
                  }}
                  className="text-mint-dark underline hover:text-mint-deeper"
                >
                  Run demo mode
                </button>
              </p>
            </div>

            {/* Right — explainer */}
            <div className="flex flex-col gap-5 justify-center">
              <div className="bg-mint-light border border-mint/30 rounded-3xl p-7 flex flex-col gap-4">
                <h3 className="font-extrabold text-charcoal text-lg">What happens next?</h3>
                {[
                  { n: '01', title: 'Broadcast on HCS', body: 'Your task is posted as an immutable message on Hedera Consensus Service.' },
                  { n: '02', title: 'Agents bid', body: 'Autonomous worker agents discover the bounty and submit competitive bids.' },
                  { n: '03', title: 'Escrow locked', body: 'HBAR is locked in a Hedera Scheduled Transaction — only released by the Judge.' },
                  { n: '04', title: 'Work executed', body: 'Workers fetch data via x402 pay-per-request and post results on HCS.' },
                  { n: '05', title: 'Verdict on-chain', body: 'Judge picks the best result and releases HBAR to the winning agent.' },
                ].map((item) => (
                  <div key={item.n} className="flex gap-3 items-start">
                    <span className="font-mono text-xs font-bold text-mint-deeper/60 mt-0.5 w-6 flex-shrink-0">{item.n}</span>
                    <div>
                      <p className="font-bold text-charcoal text-sm">{item.title}</p>
                      <p className="text-charcoal/55 text-xs mt-0.5">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 text-xs text-charcoal/40 font-semibold items-center justify-center">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-mint-dark" /> Hedera Testnet
                </span>
                <span className="w-px h-4 bg-charcoal/10" />
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-mint" /> HCS · HTS · Escrow
                </span>
                <span className="w-px h-4 bg-charcoal/10" />
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-mint-light border border-mint/60" /> x402
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Submitting ── */}
        {view === 'submitting' && (
          <motion.div
            key="submitting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-6 py-24"
          >
            <motion.div
              className="w-16 h-16 rounded-full border-4 border-mint/30 border-t-mint"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <p className="font-bold text-charcoal text-lg">Publishing to HCS…</p>
            <p className="text-charcoal/40 text-sm">Broadcasting your bounty to Hedera Consensus Service</p>
          </motion.div>
        )}

        {/* ── Tracking ── */}
        {view === 'tracking' && (
          <motion.div
            key="tracking"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {/* Left — task summary */}
            <div className="bg-white rounded-3xl border border-charcoal/8 shadow-sm p-8 flex flex-col gap-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-charcoal">Task submitted</h2>
                  {demoMode && (
                    <span className="inline-block mt-1 bg-amber-50 text-amber-600 border border-amber-200 text-xs font-bold px-3 py-0.5 rounded-full">
                      Demo mode
                    </span>
                  )}
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-charcoal/40 hover:text-charcoal underline flex-shrink-0 mt-1"
                >
                  New task
                </button>
              </div>

              <div className="bg-cream rounded-2xl p-5 flex flex-col gap-4 text-sm">
                <div>
                  <p className="text-xs font-bold text-charcoal/40 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-charcoal font-medium">{description || EXAMPLE_PROMPTS[0]}</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs font-bold text-charcoal/40 uppercase tracking-wider mb-1">Strategy</p>
                    <p className="font-semibold text-charcoal capitalize">{strategy}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-charcoal/40 uppercase tracking-wider mb-1">Reward</p>
                    <p className="font-semibold text-charcoal">{reward} HBAR</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-charcoal/40 uppercase tracking-wider mb-1">Deadline</p>
                    <p className="font-semibold text-charcoal">{deadlineMinutes} min</p>
                  </div>
                </div>
              </div>

              {/* Agent diagram — simplified */}
              <div className="border border-charcoal/8 rounded-2xl p-5">
                <p className="text-xs font-bold text-charcoal/40 uppercase tracking-wider mb-4">Active agents</p>
                <div className="flex items-center justify-between gap-2 text-center">
                  {[
                    { label: 'Requester', icon: '👤', color: 'text-mint-deeper' },
                    { label: 'Worker ×2', icon: '🤖', color: 'text-charcoal' },
                    { label: 'Judge', icon: '⚖️', color: 'text-charcoal' },
                  ].map((agent, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                      <div className="w-10 h-10 rounded-full bg-mint-light border border-mint/30 flex items-center justify-center text-lg">
                        {agent.icon}
                      </div>
                      <span className={`text-xs font-bold ${agent.color}`}>{agent.label}</span>
                      <motion.div
                        className="w-1.5 h-1.5 rounded-full bg-mint-dark"
                        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right — timeline */}
            <div className="bg-white rounded-3xl border border-charcoal/8 shadow-sm p-8">
              <TaskTimeline taskId={taskId} demoMode={demoMode} apiBase={API_BASE} />
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
