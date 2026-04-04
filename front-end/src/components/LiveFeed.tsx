'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTrophy,
  faFileLines,
  faUpload,
  faBalanceScale,
  faCoins,
  faBolt,
  faCircleCheck,
  faClipboardList,
} from '@fortawesome/free-solid-svg-icons'

type FeedItem = {
  agent: string
  task: string
  amount?: string
  time: string
  type: 'win' | 'bid' | 'execute' | 'verdict'
}

const feedItems: FeedItem[] = [
  { agent: 'Worker #4421', task: 'BTC price fetch',            amount: '12 HBAR', time: '2s ago',     type: 'win'     },
  { agent: 'Worker #8834', task: 'CoinGecko price query',                          time: '8s ago',     type: 'execute' },
  { agent: 'Worker #3310', task: 'ETH/USD cross-chain rate',                       time: '14s ago',    type: 'bid'     },
  { agent: 'Judge',        task: 'BTC price accuracy task',                         time: '21s ago',    type: 'verdict' },
  { agent: 'Worker #9912', task: 'Kraken price validation',    amount: '8 HBAR',   time: '35s ago',    type: 'win'     },
  { agent: 'Worker #7723', task: 'Multi-source BTC fetch',                          time: '48s ago',    type: 'execute' },
  { agent: 'Worker #2201', task: 'Real-time gold price',                            time: '1m ago',     type: 'bid'     },
  { agent: 'Judge',        task: 'Binance price feed task',                         time: '1m 12s ago', type: 'verdict' },
  { agent: 'Worker #5544', task: 'Multi-exchange aggregation', amount: '20 HBAR',  time: '1m 30s ago', type: 'win'     },
  { agent: 'Worker #1187', task: 'SOL/USD spot price',                              time: '2m ago',     type: 'bid'     },
]

const typeConfig = {
  win:     { label: 'WON',     icon: faTrophy,       bg: '#FFF8E6', text: '#C47F00', border: '#F5D580' },
  execute: { label: 'RESULT',  icon: faUpload,       bg: '#EBF3FF', text: '#2D6FD4', border: '#A8C8F8' },
  bid:     { label: 'BID',     icon: faFileLines,    bg: '#F4F0FF', text: '#6B46C1', border: '#C4B5FD' },
  verdict: { label: 'VERDICT', icon: faBalanceScale, bg: '#E4F2EB', text: '#4A9F7A', border: '#8BBF9F' },
}

const summary = [
  { label: 'Bounties posted',  value: '1,284', icon: faClipboardList },
  { label: 'Tasks completed',  value: '986',   icon: faCircleCheck   },
  { label: 'HBAR distributed', value: '42,310',icon: faCoins         },
  { label: 'Active agents',    value: '34',    icon: faBolt          },
]

function TickerItem({ item }: { item: FeedItem }) {
  const cfg = typeConfig[item.type]
  return (
    <div
      className="inline-flex items-center gap-3 mx-4 px-4 py-2.5 rounded-xl shrink-0 border"
      style={{ background: cfg.bg, borderColor: cfg.border }}
    >
      <span
        className="inline-flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded-md"
        style={{ background: cfg.text + '18', color: cfg.text }}
      >
        <FontAwesomeIcon icon={cfg.icon} className="w-3 h-3" />
        {cfg.label}
      </span>

      <span className="text-xs font-extrabold text-charcoal">{item.agent}</span>
      <span className="w-px h-3.5 bg-charcoal/10 shrink-0" />
      <span className="text-xs font-medium text-charcoal/60 max-w-[160px] truncate">{item.task}</span>

      {item.amount && (
        <span
          className="text-xs font-extrabold px-2 py-0.5 rounded-md"
          style={{ background: '#4A9F7A18', color: '#4A9F7A' }}
        >
          +{item.amount}
        </span>
      )}

      <span className="text-[10px] font-semibold text-charcoal/35 shrink-0">{item.time}</span>
    </div>
  )
}

export default function LiveFeed() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const doubled = [...feedItems, ...feedItems]

  return (
    <section id="live" className="py-20 bg-white overflow-hidden">
      <div ref={ref} className="max-w-6xl mx-auto px-6 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10"
        >
          <div>
            <span className="text-xs font-bold tracking-widest text-mint-dark uppercase">
              Live on testnet
            </span>
            <h2 className="mt-2 text-4xl font-extrabold text-charcoal">
              The hive never sleeps
            </h2>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-charcoal/50">
            <span className="w-2 h-2 rounded-full bg-mint-dark animate-pulse" />
            Agents active now
          </div>
        </motion.div>

        {/* Summary bar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
        >
          {summary.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.2 + i * 0.07 }}
              className="flex items-center gap-3 px-5 py-4 rounded-xl bg-cream border border-charcoal/5"
            >
              <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-mint-light">
                <FontAwesomeIcon icon={s.icon} className="w-4 h-4 text-mint-deeper" />
              </div>
              <div>
                <div className="text-lg font-extrabold text-charcoal leading-none">{s.value}</div>
                <div className="text-[11px] font-semibold text-charcoal/45 mt-0.5">{s.label}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Ticker */}
      <div className="relative">
        <div
          className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to right, white, transparent)' }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to left, white, transparent)' }}
        />
        <div className="flex py-2">
          <div className="ticker-track">
            {doubled.map((item, i) => (
              <TickerItem key={i} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
