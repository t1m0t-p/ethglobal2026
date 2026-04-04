'use client'

import { motion } from 'framer-motion'

type Agent = {
  id: string
  label: string
  role: string
  status: string
  x: number
  y: number
  delay: number
  color: string
  textColor: string
}

const agents: Agent[] = [
  {
    id: 'requester',
    label: 'Requester',
    role: 'Posts Bounty',
    status: 'POSTING',
    x: 200,
    y: 90,
    delay: 0,
    color: '#E4F2EB',
    textColor: '#1C2B2B',
  },
  {
    id: 'worker-a',
    label: 'Worker A',
    role: 'Executes Task',
    status: 'EXECUTING',
    x: 80,
    y: 250,
    delay: 0.2,
    color: '#8BBF9F',
    textColor: '#1C2B2B',
  },
  {
    id: 'worker-b',
    label: 'Worker B',
    role: 'Submits Bid',
    status: 'BIDDING',
    x: 320,
    y: 250,
    delay: 0.35,
    color: '#8BBF9F',
    textColor: '#1C2B2B',
  },
  {
    id: 'judge',
    label: 'Judge',
    role: 'LLM Evaluator',
    status: 'EVALUATING',
    x: 200,
    y: 410,
    delay: 0.5,
    color: '#4A9F7A',
    textColor: '#fff',
  },
]

const connections = [
  { from: agents[0], to: agents[1], delay: 0.7 },
  { from: agents[0], to: agents[2], delay: 0.85 },
  { from: agents[1], to: agents[3], delay: 1.0 },
  { from: agents[2], to: agents[3], delay: 1.15 },
]

const statusColors: Record<string, string> = {
  POSTING: '#6AAF8A',
  EXECUTING: '#4A9F7A',
  BIDDING: '#8BBF9F',
  EVALUATING: '#1C2B2B',
}

// Flat-top hexagon points
function hexPoints(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i)
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(' ')
}

// Moving dot along a line — uses native SVG animateMotion (no React prop issues)
function Pulse({
  x1, y1, x2, y2, delay,
}: {
  x1: number; y1: number; x2: number; y2: number; delay: number
}) {
  const dur = '2s'
  const begin = `${delay}s`
  return (
    <circle r={4} fill="#6AAF8A">
      <animateMotion
        dur={dur}
        begin={begin}
        repeatCount="indefinite"
        path={`M ${x1} ${y1} L ${x2} ${y2}`}
        keyPoints="0;1"
        keyTimes="0;1"
        calcMode="linear"
      />
      <animate
        attributeName="opacity"
        values="0;1;1;0"
        keyTimes="0;0.1;0.85;1"
        dur={dur}
        begin={begin}
        repeatCount="indefinite"
      />
    </circle>
  )
}

export default function HoneycombViz() {
  const HEX_R = 52

  return (
    <div className="relative w-full max-w-[420px] mx-auto float">
      <svg
        viewBox="0 0 400 500"
        className="w-full"
        aria-label="Agent flow diagram"
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connection lines */}
        {connections.map(({ from, to, delay }) => (
          <motion.line
            key={`${from.id}-${to.id}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="#8BBF9F"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            strokeOpacity={0.6}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay, ease: 'easeOut' }}
          />
        ))}

        {/* Animated pulses along connections */}
        {connections.map(({ from, to, delay }) => (
          <Pulse
            key={`pulse-${from.id}-${to.id}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            delay={delay + 0.6}
          />
        ))}

        {/* Agent hexagonal nodes */}
        {agents.map((agent) => (
          <motion.g
            key={agent.id}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: agent.delay, type: 'spring', stiffness: 200 }}
          >
            {/* Outer glow ring */}
            <polygon
              points={hexPoints(agent.x, agent.y, HEX_R + 6)}
              fill="none"
              stroke={agent.color === '#4A9F7A' ? '#4A9F7A' : '#8BBF9F'}
              strokeWidth={1}
              strokeOpacity={0.3}
              filter="url(#glow)"
            />

            {/* Main hexagon */}
            <motion.polygon
              points={hexPoints(agent.x, agent.y, HEX_R)}
              fill={agent.color}
              className="glow-pulse"
              animate={{
                filter: [
                  'drop-shadow(0 0 0px rgba(139,191,159,0))',
                  'drop-shadow(0 0 10px rgba(139,191,159,0.5))',
                  'drop-shadow(0 0 0px rgba(139,191,159,0))',
                ],
              }}
              transition={{ duration: 2.5, delay: agent.delay + 1, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Agent label */}
            <text
              x={agent.x}
              y={agent.y - 10}
              textAnchor="middle"
              fontSize="11"
              fontWeight="800"
              fontFamily="var(--font-jakarta)"
              fill={agent.textColor}
            >
              {agent.label}
            </text>

            {/* Agent role */}
            <text
              x={agent.x}
              y={agent.y + 6}
              textAnchor="middle"
              fontSize="9"
              fontWeight="500"
              fontFamily="var(--font-jakarta)"
              fill={agent.textColor}
              opacity={0.75}
            >
              {agent.role}
            </text>

            {/* Status badge */}
            <g>
              <rect
                x={agent.x - 28}
                y={agent.y + HEX_R + 4}
                width={56}
                height={16}
                rx={8}
                fill={statusColors[agent.status]}
                opacity={0.15}
              />
              <text
                x={agent.x}
                y={agent.y + HEX_R + 15}
                textAnchor="middle"
                fontSize="8"
                fontWeight="700"
                fontFamily="var(--font-jakarta)"
                fill={statusColors[agent.status]}
                opacity={0.9}
              >
                ● {agent.status}
              </text>
            </g>
          </motion.g>
        ))}
      </svg>

      {/* Decorative bg hexagons */}
      <div className="absolute -top-8 -right-8 w-24 h-24 hex-flat bg-mint-light opacity-40 -z-10" />
      <div className="absolute -bottom-4 -left-6 w-16 h-16 hex-flat bg-mint opacity-20 -z-10" />
    </div>
  )
}
