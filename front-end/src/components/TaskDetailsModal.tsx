'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'

// ── Types (loose — the API returns arbitrary JSON) ─────────────────────────

interface PriceData {
  sources?: string[]
  prices?: number[]
  average?: number
}

interface Result {
  workerId?: string
  data?: PriceData
}

interface Bid {
  workerId?: string
  bidAmount?: number
  estimatedTime?: string
}

interface Evidence {
  taskId?: string
  transactionId?: string
  kind?: 'escrow-release' | 'hts-reward' | 'consolation' | string
  recipient?: string
  amount?: number
  note?: string
}

interface Verdict {
  winnerId?: string
  reason?: string
  paymentAmount?: number
}

interface Escrow {
  escrowAccountId?: string
  amount?: number
  scheduleId?: string
}

interface TaskData {
  taskId?: string
  params?: {
    description?: string
    strategy?: string
    category?: string
    reward?: number
    deadlineMinutes?: number
  }
  verdict?: Verdict | null
  evidence?: Evidence | null
  evidences?: Evidence[]
  results?: Result[]
  bids?: Bid[]
  escrow?: Escrow | null
}

interface Props {
  open: boolean
  onClose: () => void
  taskId: string | null
  taskData: TaskData | null
  demoMode: boolean
}

// ── Hashscan helpers ───────────────────────────────────────────────────────

const hashscanTx = (txId: string) =>
  `https://hashscan.io/testnet/transaction/${encodeURIComponent(txId)}`
const hashscanAccount = (accountId: string) =>
  `https://hashscan.io/testnet/account/${encodeURIComponent(accountId)}`

// ── Section sub-component ──────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-bold text-charcoal/50 uppercase tracking-widest">
        {title}
      </h3>
      <div className="bg-cream rounded-2xl p-4 border border-charcoal/5">{children}</div>
    </section>
  )
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm py-1">
      <span className="text-charcoal/50 font-medium">{label}</span>
      <span className="text-charcoal font-semibold text-right break-all">{value}</span>
    </div>
  )
}

function EvidenceKindBadge({ kind }: { kind?: string }) {
  const palette: Record<string, string> = {
    'escrow-release': 'bg-mint-light text-mint-deeper border-mint/40',
    'hts-reward': 'bg-amber-50 text-amber-700 border-amber-200',
    consolation: 'bg-sky-50 text-sky-700 border-sky-200',
  }
  const label: Record<string, string> = {
    'escrow-release': 'Escrow Released',
    'hts-reward': 'HIVE Reward',
    consolation: 'Consolation',
  }
  const key = kind ?? 'payment'
  const cls = palette[key] ?? 'bg-charcoal/5 text-charcoal/70 border-charcoal/10'
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider border px-2 py-0.5 rounded-full ${cls}`}>
      {label[key] ?? key}
    </span>
  )
}

// ── Main modal ─────────────────────────────────────────────────────────────

export default function TaskDetailsModal({ open, onClose, taskId, taskData, demoMode }: Props) {
  // Lock scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Close on ESC
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const bids = taskData?.bids ?? []
  const results = taskData?.results ?? []
  const verdict = taskData?.verdict ?? null
  const evidences = taskData?.evidences ?? (taskData?.evidence ? [taskData.evidence] : [])
  const escrow = taskData?.escrow ?? null
  const params = taskData?.params ?? {}

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Panel */}
          <motion.div
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-charcoal/10"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 p-6 border-b border-charcoal/8">
              <div>
                <h2 className="text-2xl font-extrabold text-charcoal">Task Details</h2>
                <p className="text-charcoal/50 text-xs mt-1 font-mono">
                  {taskId ?? '—'}
                  {demoMode && (
                    <span className="ml-2 bg-amber-50 text-amber-600 border border-amber-200 text-xs font-bold px-2 py-0.5 rounded-full">
                      DEMO
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-full w-9 h-9 flex items-center justify-center text-charcoal/60 hover:bg-charcoal/5 hover:text-charcoal transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="overflow-y-auto flex-1 p-6 flex flex-col gap-5">
              {/* Task params */}
              <Section title="Task">
                {params.description && (
                  <p className="text-charcoal text-sm font-medium mb-3">{params.description}</p>
                )}
                <div className="grid grid-cols-2 gap-x-4">
                  {params.strategy && <KV label="Strategy" value={<span className="capitalize">{params.strategy}</span>} />}
                  {params.category && <KV label="Category" value={params.category} />}
                  {params.reward !== undefined && <KV label="Reward" value={`${params.reward} HBAR`} />}
                  {params.deadlineMinutes !== undefined && (
                    <KV label="Deadline" value={`${params.deadlineMinutes} min`} />
                  )}
                </div>
              </Section>

              {/* Escrow */}
              {escrow && (escrow.escrowAccountId || escrow.amount) && (
                <Section title="Escrow">
                  {escrow.escrowAccountId && (
                    <KV
                      label="Account"
                      value={
                        <a
                          href={hashscanAccount(escrow.escrowAccountId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-mint-dark hover:text-mint-deeper underline decoration-mint/30 font-mono"
                        >
                          {escrow.escrowAccountId} ↗
                        </a>
                      }
                    />
                  )}
                  {escrow.amount !== undefined && <KV label="Locked" value={`${escrow.amount} HBAR`} />}
                </Section>
              )}

              {/* Bids */}
              <Section title={`Bids (${bids.length})`}>
                {bids.length === 0 ? (
                  <p className="text-charcoal/40 text-sm italic">No bids captured</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-charcoal/5">
                    {bids.map((b, i) => (
                      <li key={i} className="py-2 flex justify-between items-center gap-3">
                        <span className="font-mono text-xs text-charcoal/70 truncate">
                          {b.workerId ?? `worker-${i + 1}`}
                        </span>
                        <span className="text-sm text-charcoal font-semibold flex-shrink-0">
                          {b.bidAmount ?? '—'} HBAR
                          {b.estimatedTime && (
                            <span className="ml-2 text-xs text-charcoal/40 font-normal">
                              · {b.estimatedTime}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* Results (with sources) */}
              <Section title={`Submissions (${results.length})`}>
                {results.length === 0 ? (
                  <p className="text-charcoal/40 text-sm italic">No results submitted</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {results.map((r, i) => {
                      const isWinner = verdict?.winnerId && r.workerId === verdict.winnerId
                      return (
                        <li
                          key={i}
                          className={`rounded-xl border p-3 ${
                            isWinner
                              ? 'bg-mint-light border-mint/40'
                              : 'bg-white border-charcoal/8'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="font-mono text-xs text-charcoal/70 truncate">
                              {r.workerId ?? `worker-${i + 1}`}
                            </span>
                            {isWinner && (
                              <span className="text-[10px] bg-mint text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
                                Winner
                              </span>
                            )}
                          </div>
                          {r.data?.average !== undefined && (
                            <p className="text-charcoal font-bold text-sm mb-2">
                              Avg: {typeof r.data.average === 'number' ? r.data.average.toLocaleString() : r.data.average}
                            </p>
                          )}
                          {r.data?.sources && r.data.sources.length > 0 && (
                            <div className="flex flex-col gap-1 mt-1">
                              <span className="text-[10px] font-bold text-charcoal/40 uppercase tracking-wider">
                                Sources
                              </span>
                              <ul className="flex flex-wrap gap-1.5">
                                {r.data.sources.map((s, j) => {
                                  const isUrl = /^https?:\/\//i.test(s)
                                  return (
                                    <li
                                      key={j}
                                      className="text-[11px] bg-charcoal/5 border border-charcoal/10 rounded-full px-2 py-0.5 text-charcoal/70 max-w-[280px] truncate"
                                    >
                                      {isUrl ? (
                                        <a
                                          href={s}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-mint-dark hover:text-mint-deeper underline decoration-mint/30"
                                        >
                                          {s} ↗
                                        </a>
                                      ) : (
                                        s
                                      )}
                                      {r.data?.prices?.[j] !== undefined && (
                                        <span className="ml-1 text-charcoal/40">
                                          · {r.data.prices[j]}
                                        </span>
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>

              {/* Verdict */}
              {verdict && (
                <Section title="Verdict">
                  {verdict.winnerId && (
                    <KV
                      label="Winner"
                      value={
                        <a
                          href={hashscanAccount(verdict.winnerId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-mint-dark hover:text-mint-deeper underline decoration-mint/30 font-mono"
                        >
                          {verdict.winnerId} ↗
                        </a>
                      }
                    />
                  )}
                  {verdict.paymentAmount !== undefined && (
                    <KV label="Payment" value={`${verdict.paymentAmount} HBAR`} />
                  )}
                  {verdict.reason && (
                    <div className="mt-2 text-xs text-charcoal/60 italic border-t border-charcoal/5 pt-2">
                      “{verdict.reason}”
                    </div>
                  )}
                </Section>
              )}

              {/* On-chain transactions */}
              {evidences.length > 0 && (
                <Section title={`On-chain Transactions (${evidences.length})`}>
                  <ul className="flex flex-col gap-2">
                    {evidences.map((e, i) => (
                      <li
                        key={i}
                        className="rounded-xl border border-charcoal/8 bg-white p-3 flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <EvidenceKindBadge kind={e.kind} />
                          {e.amount !== undefined && (
                            <span className="text-xs font-bold text-charcoal">
                              {e.amount}{' '}
                              {e.kind === 'escrow-release' ? 'HBAR' : 'HIVE'}
                            </span>
                          )}
                        </div>
                        {e.recipient && (
                          <p className="text-[11px] font-mono text-charcoal/60 truncate">
                            → {e.recipient}
                          </p>
                        )}
                        {e.note && (
                          <p className="text-[11px] text-charcoal/50 italic">{e.note}</p>
                        )}
                        {e.transactionId && (
                          <a
                            href={hashscanTx(e.transactionId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-mint-dark hover:text-mint-deeper underline decoration-mint/30 truncate mt-1"
                          >
                            🔗 {e.transactionId} ↗
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {demoMode && (
                <p className="text-center text-[11px] text-charcoal/40 italic">
                  Demo mode — transactions are simulated; Hashscan links will not resolve.
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-charcoal/8 p-4 flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-full bg-charcoal text-white text-sm font-bold hover:bg-mint-deeper transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
