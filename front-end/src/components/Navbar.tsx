'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-md shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 relative">
            <Image src="/logo.png" alt="Hivera" fill className="object-contain" />
          </div>
          <span className="font-extrabold text-xl text-charcoal tracking-wide">
            HIVERA
          </span>
        </div>

        {/* Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-charcoal/70">
          <a href="#how-it-works" className="hover:text-mint-dark transition-colors">How it works</a>
          <a href="#why" className="hover:text-mint-dark transition-colors">Why Hedera</a>
          <a href="#live" className="hover:text-mint-dark transition-colors">Live feed</a>
        </div>

        {/* CTA */}
        <a
          href="https://github.com/t1m0t-p/ethglobal2026"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-charcoal text-white text-sm font-bold px-5 py-2.5 rounded-full hover:bg-mint-deeper transition-colors"
        >
          View on GitHub
        </a>
      </div>
    </nav>
  )
}
