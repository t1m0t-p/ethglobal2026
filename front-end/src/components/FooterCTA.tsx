'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRocket, faBook } from '@fortawesome/free-solid-svg-icons'

const teamMembers = [
  { name: 'Antoine',   github: 'Antoine0703'  },
  { name: 'Ewan',      github: 'PHILIPPEEwan' },
  { name: 'Manmohit',  github: 'Manmohit509'  },
  { name: 'Timothée',  github: 't1m0t-p'      },
]

function HexBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[
        { w: 140, top: '-10%', left: '5%',  opacity: 0.12 },
        { w: 90,  top: '20%',  right: '8%', opacity: 0.10 },
        { w: 60,  bottom: '10%', left: '15%', opacity: 0.08 },
        { w: 200, bottom: '-15%', right: '-5%', opacity: 0.07 },
        { w: 50,  top: '50%',  left: '40%', opacity: 0.06 },
      ].map((hex, i) => (
        <div
          key={i}
          className="absolute hex-flat bg-white"
          style={{ width: hex.w, height: hex.w, ...hex } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

export default function FooterCTA() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <footer>
      <section
        ref={ref}
        className="relative py-28 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #6AAF8A 0%, #4A9F7A 50%, #1C2B2B 100%)' }}
      >
        <HexBg />

        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center flex flex-col items-center gap-8">
          {/* Bee animation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.6, type: 'spring', stiffness: 200 }}
            className="w-40 h-40 relative"
          >
            <video
              src="/bee-animation.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-contain"
              style={{ mixBlendMode: 'multiply' }}
            />
          </motion.div>

          {/* Text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex flex-col gap-4"
          >
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight">
              Ready to launch the hive?
            </h2>
            <p className="text-white/65 font-medium text-lg max-w-md mx-auto">
              Spin up agents, post a bounty, and watch autonomous AI settle it on-chain — in seconds.
            </p>
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap justify-center gap-4"
          >
            <a
              href="https://github.com/t1m0t-p/ethglobal2026"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 bg-white text-charcoal font-extrabold px-8 py-4 rounded-full text-sm hover:scale-105 active:scale-95 transition-transform shadow-lg"
            >
              <FontAwesomeIcon icon={faRocket} className="w-4 h-4" />
              Launch the Hive
            </a>
            <a
              href="https://github.com/t1m0t-p/ethglobal2026#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 bg-white/10 border border-white/30 text-white font-bold px-8 py-4 rounded-full text-sm hover:bg-white/20 hover:scale-105 active:scale-95 transition-all"
            >
              <FontAwesomeIcon icon={faBook} className="w-4 h-4" />
              Read the docs
            </a>
          </motion.div>

          {/* Team */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-wrap justify-center gap-3 pt-4"
          >
            {teamMembers.map((member, i) => (
              <motion.a
                key={member.github}
                href={`https://github.com/${member.github}`}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 10 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.5 + i * 0.08 }}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-full"
              >
                <img
                  src={`https://github.com/${member.github}.png?size=28`}
                  alt={member.name}
                  className="w-6 h-6 rounded-full"
                />
                <span className="text-white/80 text-xs font-semibold">{member.name}</span>
              </motion.a>
            ))}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.8 }}
            className="text-white/35 text-xs font-semibold"
          >
            PoC Innovation × ETHGlobal Cannes 2026
          </motion.p>
        </div>
      </section>

      <div className="bg-charcoal py-5 px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-white/30 font-semibold">
          <span>© 2026 Hivera — PoC Innovation</span>
          <div className="flex gap-5">
            <a href="https://hedera.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">Hedera</a>
            <a href="https://ethglobal.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">ETHGlobal</a>
            <a href="https://github.com/t1m0t-p/ethglobal2026" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
