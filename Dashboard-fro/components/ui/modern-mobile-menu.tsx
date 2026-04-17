'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { IconType } from 'react'

type IconComponentType = React.ElementType<{ className?: string }>
export interface InteractiveMenuItem {
  label: string
  icon: IconComponentType
  href?: string
}

export interface InteractiveMenuProps {
  items?: InteractiveMenuItem[]
  accentColor?: string
}

const defaultItems: InteractiveMenuItem[] = [
  { label: 'home', icon: () => null, href: '/' },
  { label: 'strategy', icon: () => null, href: '/' },
  { label: 'period', icon: () => null, href: '/' },
  { label: 'security', icon: () => null, href: '/' },
  { label: 'settings', icon: () => null, href: '/' },
]

const defaultAccentColor = 'var(--component-active-color-default)'

const InteractiveMenu: React.FC<InteractiveMenuProps> = ({ items, accentColor }) => {
  const router = useRouter()
  const pathname = usePathname()

  const finalItems = useMemo(() => {
    const isValid = items && Array.isArray(items) && items.length >= 2 && items.length <= 5
    if (!isValid) {
      console.warn("InteractiveMenu: 'items' prop is invalid or missing. Using default items.", items)
      return defaultItems
    }
    return items
  }, [items])

  const [activeIndex, setActiveIndex] = useState(0)
  const textRefs = useRef<(HTMLElement | null)[]>([])
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const currentIndex = finalItems.findIndex((item) => item.href === pathname)
    if (currentIndex !== -1) {
      setActiveIndex(currentIndex)
    }
  }, [pathname, finalItems])

  useEffect(() => {
    const setLineWidth = () => {
      const activeItemElement = itemRefs.current[activeIndex]
      const activeTextElement = textRefs.current[activeIndex]

      if (activeItemElement && activeTextElement) {
        const textWidth = activeTextElement.offsetWidth
        activeItemElement.style.setProperty('--lineWidth', `${textWidth}px`)
      }
    }

    setLineWidth()
    window.addEventListener('resize', setLineWidth)
    return () => {
      window.removeEventListener('resize', setLineWidth)
    }
  }, [activeIndex, finalItems])

  const handleItemClick = (index: number) => {
    const item = finalItems[index]
    setActiveIndex(index)
    if (item.href) {
      router.push(item.href)
    }
  }

  const navStyle = useMemo(() => {
    const activeColor = accentColor || defaultAccentColor
    return { '--component-active-color': activeColor } as React.CSSProperties
  }, [accentColor])

  return (
    <nav className="flex items-center gap-2" role="navigation" style={navStyle}>
      {finalItems.map((item, index) => {
        const isActive = index === activeIndex
        const IconComponent = item.icon

        return (
          <button
            key={item.label}
            className={`relative flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-all duration-300 ${isActive ? 'bg-white/15 text-white shadow-[0_0_0_1px_rgba(96,165,250,0.18)]' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
            onClick={() => handleItemClick(index)}
            ref={(el) => (itemRefs.current[index] = el)}
            style={{ '--lineWidth': '0px' } as React.CSSProperties}
          >
            <span className={`${isActive ? 'text-white' : 'text-white/70'} transition-colors duration-300`}>
              <IconComponent className="h-4 w-4" />
            </span>
            <strong
              ref={(el) => (textRefs.current[index] = el)}
              className={`overflow-hidden whitespace-nowrap text-sm transition-all duration-300 ${isActive ? 'max-w-[8rem] opacity-100' : 'max-w-0 opacity-0'}`}
            >
              {item.label}
            </strong>
            <span
              className="absolute bottom-1 left-1/2 h-[2px] bg-cyan-400 transition-all duration-300"
              style={{ width: isActive ? 'var(--lineWidth)' : '0px', transform: 'translateX(-50%)' }}
            />
          </button>
        )
      })}
    </nav>
  )
}

export { InteractiveMenu }
