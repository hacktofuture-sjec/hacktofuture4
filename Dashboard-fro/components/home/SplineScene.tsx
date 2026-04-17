'use client'

import React, { useState, useEffect } from 'react'

interface SplineSceneProps {
  scene: string
  className?: string
}

function isLikelySplineSceneUrl(url: string) {
  return /spline\.design\/.*\.splinecode(\?.*)?$/.test(url)
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const safe = isLikelySplineSceneUrl(scene)

  const fallback = (
    <div className="flex h-full w-full items-center justify-center">
      <div className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-xs text-white/70 backdrop-blur-md">
        3D scene unavailable
      </div>
    </div>
  )

  if (!safe) return fallback

  if (!isMounted) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-2 border-white/5 border-t-blue-500 animate-spin" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20">Initialising 3D Agent</span>
        </div>
      </div>
    )
  }

  // Use iframe method to avoid React Spline component issues
  // Convert scene URL to canvas URL for embedding
  const canvasUrl = scene.replace('.splinecode', '.canvas')

  return (
    <iframe
      src={canvasUrl}
      frameBorder="0"
      width="100%"
      height="100%"
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        borderRadius: '0',
      }}
      allowFullScreen
      loading="lazy"
    />
  )
}
