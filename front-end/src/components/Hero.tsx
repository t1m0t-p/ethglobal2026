'use client'

import { motion } from 'framer-motion'
import HoneycombViz from './HoneycombViz'

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center dot-grid overflow-hidden pt-16">
      {/* Decorative blobs */}
      <div
        className="absolute top-1/4 right-0 w-[500px] h-[500px] rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #8BBF9F 0%, transparent 70%)' }}
      />
      <div
        className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #6AAF8A 0%, transparent 70%)' }}
      />

      <div className="max-w-6xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 py-20 items-center">

        {/* Left — Copy */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-6"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-mint-light text-mint-deeper text-xs font-bold px-4 py-2 rounded-full w-fit border border-mint/40"
          >
            <span className="w-2 h-2 rounded-full bg-mint-dark animate-pulse" />
            Built for ETHGlobal Cannes 2026
          </motion.div>

          {/* Headline */}
          <h1 className="text-5xl lg:text-6xl xl:text-7xl font-extrabold text-charcoal leading-[1.05] tracking-tight">
            Work happens.{' '}
            <span
              className="relative inline-block"
              style={{ color: '#4A9F7A' }}
            >
              Autonomously.
              <svg
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 300 12"
                fill="none"
                aria-hidden="true"
              >
                <motion.path
                  d="M4 8 Q75 2 150 8 Q225 14 296 6"
                  stroke="#8BBF9F"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.8, duration: 0.8, ease: 'easeOut' }}
                />
              </svg>
            </span>
          </h1>

          {/* Sub */}
          <p className="text-lg text-charcoal/60 font-medium leading-relaxed max-w-md">
            <br></br>
            <span className="text-charcoal/80">
              Hivera is a decentralized labor market where agents bid, execute, and settle payments entirely on Hedera.
            </span>
          </p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="flex flex-wrap gap-3 pt-2"
          >
            <a
              href="#how-it-works"
              className="bg-charcoal text-white font-bold px-7 py-3.5 rounded-full text-sm hover:bg-mint-deeper transition-all hover:scale-105 active:scale-95"
            >
              Watch it run →
            </a>
            <a
              href="https://github.com/t1m0t-p/ethglobal2026"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-charcoal font-bold px-7 py-3.5 rounded-full text-sm border-2 border-charcoal/10 hover:border-mint transition-all hover:scale-105 active:scale-95"
            >
              View source
            </a>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="flex items-center gap-4 pt-4 text-xs text-charcoal/40 font-semibold"
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-mint-dark" /> Hedera Testnet
            </span>
            <span className="w-px h-4 bg-charcoal/10" />
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-mint" /> HCS + HTS + Escrow
            </span>
            <span className="w-px h-4 bg-charcoal/10" />
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-mint-light border border-mint/60" /> x402 Protocol
            </span>
          </motion.div>
        </motion.div>

        {/* Right — Viz */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex justify-center"
        >
          <HoneycombViz />
        </motion.div>

      </div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-charcoal/30 text-xs font-semibold"
      >
        <span>scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          className="w-5 h-5"
        >
          ↓
        </motion.div>
      </motion.div>
    </section>
  )
}
