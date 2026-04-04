import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import HowItWorks from '@/components/HowItWorks'
import Stats from '@/components/Stats'
import LiveFeed from '@/components/LiveFeed'
import FooterCTA from '@/components/FooterCTA'

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Stats />
        <LiveFeed />
      </main>
      <FooterCTA />
    </>
  )
}
