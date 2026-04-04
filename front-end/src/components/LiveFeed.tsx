'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

type FeedItem = {
  agent: string
  action: string
  amount?: string
  task: string
  time: string
  type: 'win' | 'bid' | 'execute' | 'verdict'
}

const feedItems: FeedItem[] = [
  { agent: '0.0.4421', action: 'won', amount: '12 HBAR', task: 'BTC price fetch', time: '2s ago', type: 'win' },
  { agent: '0.0.8834', action: 'submitted result for', task: 'CoinGecko price query', time: '8s ago', type: 'execute' },
  { agent: '0.0.3310', action: 'placed bid on', task: 'ETH/USD cross-chain rate', time: '14s ago', type: 'bid' },
  { agent: 'Judge', action: 'issued verdict on', task: 'BTC price accuracy task', time: '21s ago', type: 'verdict' },
  { agent: '0.0.9912', action: 'won', amount: '8 HBAR', task: 'Kraken price validation', time: '35s ago', type: 'win' },
  { agent: '0.0.7723', action: 'submitted result for', task: 'multi-source BTC fetch', time: '48s ago', type: 'execute' },
  { agent: '0.0.2201', action: 'placed bid on', task: 'real-time gold price', time: '1m ago', type: 'bid' },
  { agent: 'Judge', action: 'released escrow for', task: 'Binance price feed task', time: '1m 12s ago', type: 'verdict' },
  { agent: '0.0.5544', action: 'won', amount: '20 HBAR', task: 'multi-exchange aggregation', time: '1m 30s ago', type: 'win' },
  { agent: '0.0.1187', action: 'placed bid on', task: 'SOL/USD spot price', time: '2m ago', type: 'bid' },
]

const typeStyles: Record<FeedItem['type'], { dot: string; bg: string; text: string }> = {
  win: { dot: '#4A9F7A', bg: '#E4F2EB', text: '#4A9F7A' },
  execute: { dot: '#8BBF9F', bg: '#F0FAF4', text: '#6AAF8A' },
  bid: { dot: '#1C2B2B', bg: '#F5F5F5', text: '#1C2B2B' },
  verdict: { dot: '#6AAF8A', bg: '#E8F5EE', text: '#4A9F7A' },
}

function TickerItem({ item }: { item: FeedItem }) {
  const style = typeStyles[item.type]
  return (
    <div className="inline-flex items-center gap-2.5 mx-6 shrink-0">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: style.dot }}
      />
      <span className="text-sm font-semibold text-charcoal/70">
        <span className="font-extrabold text-charcoal">
          Worker {item.agent}
        </span>{' '}
        {item.action}{' '}
        {item.amount && (
          <span style={{ color: style.text }} className="font-bold">
            {item.amount}
          </span>
        )}{' '}
        for{' '}
        <span className="italic">{item.task}</span>
      </span>
      <span
        className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
        style={{ background: style.bg, color: style.text }}
      >
        {item.time}
      </span>
    </div>
  )
}

export default function LiveFeed() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  // Duplicate for seamless loop
  const doubled = [...feedItems, ...feedItems]

  return (
    <section id="live" className="py-20 bg-cream overflow-hidden">
      <div ref={ref} className="max-w-6xl mx-auto px-6 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
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
      </div>

      {/* Ticker */}
      <div className="relative">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to right, #FAF8F2, transparent)' }} />
        <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to left, #FAF8F2, transparent)' }} />

        <div className="flex py-4 border-y border-charcoal/5">
          <div className="ticker-track">
            {doubled.map((item, i) => (
              <TickerItem key={i} item={item} />
            ))}
          </div>
        </div>
      </div>

      {/* Second row — reverse */}
      <div className="relative mt-3">
        <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to right, #FAF8F2, transparent)' }} />
        <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to left, #FAF8F2, transparent)' }} />

        <div className="flex py-4 border-y border-charcoal/5">
          <div
            className="ticker-track"
            style={{ animationDirection: 'reverse', animationDuration: '25s' }}
          >
            {[...doubled].reverse().map((item, i) => (
              <TickerItem key={i} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
