import type { TrackPoint } from '../types/ride'
import { haversine } from '../features/stats/haversine'

type Props = {
  track: TrackPoint[]
  /** Poster mode: bigger fonts/strokes for 1080-wide PNG rendering. */
  poster?: boolean
  className?: string
}

/** Sample speed (m/s) for each point — uses reported speed else derives from haversine/Δt. */
function sampleSpeeds(track: TrackPoint[]): number[] {
  if (track.length < 2) return []
  const out: number[] = [0]
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1]
    const b = track[i]
    if (b.speed != null) {
      out.push(Math.max(0, b.speed))
      continue
    }
    const dt = (b.ts - a.ts) / 1000
    if (dt <= 0) {
      out.push(0)
      continue
    }
    out.push(haversine(a.lat, a.lng, b.lat, b.lng) / dt)
  }
  return out
}

/** 5-point centered moving average — smooths GPS speed jitter without lag. */
function smooth(values: number[]): number[] {
  return values.map((_, i) => {
    const win = values.slice(Math.max(0, i - 2), Math.min(values.length, i + 3))
    return win.reduce((s, v) => s + v, 0) / win.length
  })
}

export default function SpeedGraph({ track, poster = false, className }: Props) {
  const W = poster ? 1000 : 600
  const H = poster ? 320 : 180
  const PAD_X = poster ? 40 : 24
  const PAD_TOP = poster ? 28 : 16
  const PAD_BOTTOM = poster ? 44 : 28

  const samples = smooth(sampleSpeeds(track))

  if (samples.length < 2) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/60 text-sm text-neutral-500 ${className ?? ''}`}
        style={{ width: poster ? W : undefined, height: H }}
      >
        Not enough data for a speed graph.
      </div>
    )
  }

  const maxMps = Math.max(...samples, 1)
  const maxKmh = Math.ceil((maxMps * 3.6) / 10) * 10 || 10
  const innerW = W - PAD_X * 2
  const innerH = H - PAD_TOP - PAD_BOTTOM

  const points = samples.map((v, i) => {
    const x = PAD_X + (i / (samples.length - 1)) * innerW
    const kmh = v * 3.6
    const y = PAD_TOP + innerH - (kmh / maxKmh) * innerH
    return { x, y }
  })

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${(PAD_TOP + innerH).toFixed(1)} L${points[0].x.toFixed(1)},${(PAD_TOP + innerH).toFixed(1)} Z`

  const yTicks = [0, maxKmh / 2, maxKmh]
  const gridStroke = 'rgba(255,255,255,0.06)'
  const textColor = 'rgba(255,255,255,0.55)'

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={poster ? W : undefined}
      height={poster ? H : undefined}
      preserveAspectRatio="none"
      className={className}
      style={{
        background: '#0a0a0a',
        borderRadius: poster ? 0 : 12,
        display: 'block',
        width: poster ? `${W}px` : '100%',
      }}
    >
      {yTicks.map((k) => {
        const y = PAD_TOP + innerH - (k / maxKmh) * innerH
        return (
          <g key={k}>
            <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke={gridStroke} />
            <text
              x={PAD_X - 8}
              y={y + 4}
              fontSize={poster ? 16 : 10}
              fill={textColor}
              textAnchor="end"
              fontFamily="Inter, -apple-system, sans-serif"
              fontWeight={500}
            >
              {Math.round(k)}
            </text>
          </g>
        )
      })}
      <text
        x={PAD_X}
        y={H - PAD_BOTTOM + (poster ? 28 : 18)}
        fontSize={poster ? 16 : 10}
        fill={textColor}
        fontFamily="Inter, -apple-system, sans-serif"
        fontWeight={500}
      >
        Speed (km/h) over distance
      </text>
      <path d={areaPath} fill="rgba(255,77,0,0.18)" />
      <path d={linePath} fill="none" stroke="#ff4d00" strokeWidth={poster ? 3.5 : 2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
