import { cn } from "@/lib/utils"

interface SparklineProps {
  data: number[]
  color: string
  gradientId: string
  height: number
  className?: string
}

export function Sparkline({ 
  data, 
  color, 
  gradientId, 
  height, 
  className 
}: SparklineProps) {
  if (!data || data.length === 0) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100
    const y = 100 - ((value - min) / range) * 100
    return `${x},${y}`
  }).join(' ')

  return (
    <div className={cn("w-full", className)}>
      <svg 
        viewBox="0 0 100 100" 
        className="w-full h-full"
        style={{ height: `${height}px` }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <polyline
          fill={`url(#${gradientId})`}
          stroke={color}
          strokeWidth="2"
          points={points}
        />
      </svg>
    </div>
  )
}
