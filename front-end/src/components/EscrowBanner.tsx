'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function EscrowBanner() {
  return (
    <div>
      <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link href="/escrow" className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-2xl">
            <div className="relative overflow-hidden rounded-2xl border border-amber-300/70 bg-amber-50/80 backdrop-blur-sm px-5 py-4 flex items-center gap-4 hover:border-amber-400 hover:bg-amber-50 transition-all duration-200 hover:shadow-md hover:shadow-amber-100/60">

              {/* Left stripe */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-amber-500 rounded-l-2xl" />

              {/* Icon */}
              <div className="shrink-0 ml-2 w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#d97706' }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-extrabold tracking-widest text-amber-600 uppercase">
                    Security Notice
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    On-chain escrow
                  </span>
                </div>
                <p className="text-sm font-semibold text-charcoal leading-snug">
                  All payments are locked in a Hedera Scheduled Transaction before any work begins —
                  funds cannot move until the Judge signs off.{' '}
                  <span className="text-amber-600 font-bold group-hover:underline underline-offset-2">
                    How is this secured? →
                  </span>
                </p>
              </div>

              {/* Arrow hint */}
              <div className="shrink-0 w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 group-hover:bg-amber-200 group-hover:translate-x-0.5 transition-all duration-200">
                <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
                  <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06L7.28 12.78a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
                </svg>
              </div>
            </div>
          </Link>
      </motion.div>
    </div>
  )
}
