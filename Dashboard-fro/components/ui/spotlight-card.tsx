import React, { ReactNode, CSSProperties } from 'react'

import { cn } from '@/lib/utils'
import { GradientBackground4 } from '@/components/ui/gradient-background-4'

interface GlowCardProps {
  children: ReactNode
  className?: string
  glowColor?: 'blue' | 'purple' | 'green' | 'red' | 'orange'
  size?: 'sm' | 'md' | 'lg'
  width?: string | number
  height?: string | number
  customSize?: boolean
}

const sizeMap = {
  sm: 'w-56 h-56',
  md: 'w-full',
  lg: 'w-full',
}

const GlowCard: React.FC<GlowCardProps> = ({
  children,
  className = '',
  size = 'md',
  width,
  height,
  customSize = false,
}) => {
  const style: CSSProperties = {}

  if (width !== undefined) {
    style.width = typeof width === 'number' ? `${width}px` : width
  }

  if (height !== undefined) {
    style.height = typeof height === 'number' ? `${height}px` : height
  }

  const sizeClasses = customSize ? '' : sizeMap[size]

  return (
    <div
      style={style}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 text-gray-900 shadow-sm',
        'dark:border-white/10 dark:bg-[#0B1220]/50 dark:text-white dark:shadow-[0_8px_32px_rgba(0,0,0,0.65)] dark:backdrop-blur-xl',
        sizeClasses,
        className,
      )}
    >
      <GradientBackground4 />
      <div className="relative z-10 min-h-0">{children}</div>
    </div>
  )
}

export { GlowCard }
