'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type ScrollLinkedSequenceProps = {
  className?: string
  /**
   * URL pattern for frames. Must be in `public/` and start with `/`.
   * Example: `/frames/sphere/frame-{index}.jpg`
   */
  srcPattern?: string
  frameCount?: number
  /**
   * `index` is 1-based, must return a string matching files in `public/`.
   */
  formatIndex?: (index: number) => string
  /**
   * Total scroll length for the scrollytelling section.
   * Example: 500 means 500vh.
   */
  scrollVh?: number
  /**
   * Optional autonomous playback while the section is in view.
   * Scroll still takes precedence when user moves.
   */
  autoplayMs?: number
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function coverDraw(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasW: number,
  canvasH: number,
) {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih) return

  const scale = Math.max(canvasW / iw, canvasH / ih)
  const w = iw * scale
  const h = ih * scale
  const x = (canvasW - w) * 0.5
  const y = (canvasH - h) * 0.5
  ctx.drawImage(img, x, y, w, h)
}

export function ScrollLinkedSequence({
  className,
  srcPattern = '/frames/sphere/frame-{index}.jpg',
  frameCount = 30,
  formatIndex = (i) => String(i).padStart(4, '0'),
  scrollVh = 700,
  autoplayMs = 32000,
}: ScrollLinkedSequenceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imagesRef = useRef<(HTMLImageElement | null)[]>([])
  const rafRef = useRef<number | null>(null)
  const currentFrameRef = useRef(0)
  const targetFrameRef = useRef(0)
  const lastDrawnRef = useRef(0)
  const autoProgressRef = useRef(0)
  const lastTimeRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState(0)

  const frameUrls = useMemo(() => {
    const urls: string[] = []
    for (let i = 1; i <= frameCount; i++) {
      urls.push(srcPattern.replace('{index}', formatIndex(i)))
    }
    return urls
  }, [srcPattern, frameCount, formatIndex])

  useEffect(() => {
    imagesRef.current = new Array(frameCount).fill(null)
    let alive = true

    const preload = async () => {
      const first = new Image()
      first.decoding = 'async'
      first.loading = 'eager'
      first.src = frameUrls[0]
      imagesRef.current[0] = first

      await new Promise<void>((resolve) => {
        const done = () => resolve()
        if (first.complete) return done()
        first.onload = done
        first.onerror = done
      })

      if (!alive) return
      setReady(true)

      // Preload remaining frames with slight concurrency.
      const maxInFlight = 6
      let inFlight = 0
      let nextIndex = 1

      await new Promise<void>((resolveAll) => {
        const pump = () => {
          if (!alive) return resolveAll()
          if (nextIndex >= frameCount && inFlight === 0) return resolveAll()

          while (inFlight < maxInFlight && nextIndex < frameCount) {
            const i = nextIndex++
            inFlight++
            const img = new Image()
            img.decoding = 'async'
            img.loading = 'eager'
            img.src = frameUrls[i]
            imagesRef.current[i] = img
            const done = () => {
              inFlight--
              pump()
            }
            if (img.complete) done()
            else {
              img.onload = done
              img.onerror = done
            }
          }
        }
        pump()
      })
    }

    void preload()

    return () => {
      alive = false
    }
  }, [frameCount, frameUrls])

  useEffect(() => {
    const canvas = canvasRef.current
    const host = hostRef.current
    if (!canvas || !host) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const resize = () => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
      const w = Math.floor(window.innerWidth)
      const h = Math.floor(window.innerHeight)
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
    }

    const computeProgress = () => {
      const rect = host.getBoundingClientRect()
      const viewport = window.innerHeight
      const total = Math.max(1, rect.height - viewport)
      const p = clamp01(-rect.top / total)
      return p
    }

    const nearestLoadedIndex = (wanted: number) => {
      const arr = imagesRef.current
      if (arr[wanted]?.complete) return wanted
      for (let d = 1; d < frameCount; d++) {
        const a = wanted - d
        if (a >= 0 && arr[a]?.complete) return a
        const b = wanted + d
        if (b < frameCount && arr[b]?.complete) return b
      }
      return lastDrawnRef.current
    }

    const drawFrame = (wantedIndex: number) => {
      const frameIndex = nearestLoadedIndex(wantedIndex)
      const img = imagesRef.current[frameIndex]
      if (!img || !img.complete) return
      ctx.fillStyle = '#030712'
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight)
      coverDraw(ctx, img, window.innerWidth, window.innerHeight)
      lastDrawnRef.current = frameIndex
    }

    const tick = () => {
      const now = performance.now()
      if (!lastTimeRef.current) lastTimeRef.current = now
      const dt = now - lastTimeRef.current
      lastTimeRef.current = now

      const p = computeProgress()
      // Auto-play only while the sticky hero is currently in view.
      const rect = host.getBoundingClientRect()
      const inView = rect.bottom > 0 && rect.top < window.innerHeight
      if (inView && autoProgressRef.current < 1) {
        autoProgressRef.current = clamp01(
          autoProgressRef.current + dt / Math.max(1, autoplayMs),
        )
      }

      const effectiveP = Math.max(p, autoProgressRef.current)
      setProgress(effectiveP)

      // Reserve a short end-hold so the final frame is fully visible
      // before the sticky section releases into the next content block.
      const endHoldStart = 0.92
      const playable = effectiveP < endHoldStart ? effectiveP / endHoldStart : 1
      const eased = smoothstep(0, 1, playable)
      const target = eased * (frameCount - 1)
      targetFrameRef.current = target

      // Snap to exact final frame at the end to prevent any perceived
      // premature exit or "almost finished" state while unpinning.
      if (effectiveP >= 0.999) {
        currentFrameRef.current = frameCount - 1
      } else {
        const next = lerp(currentFrameRef.current, targetFrameRef.current, 0.12)
        currentFrameRef.current = next
      }

      const idx = Math.max(
        0,
        Math.min(frameCount - 1, Math.round(currentFrameRef.current)),
      )
      drawFrame(idx)

      rafRef.current = window.requestAnimationFrame(tick)
    }

    resize()
    window.addEventListener('resize', resize, { passive: true })
    rafRef.current = window.requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', resize)
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    }
  }, [frameCount])

  const blocks = [
    {
      key: 'stable',
      start: 0.0,
      end: 0.2,
      kicker: 'Distributed microservices — continuously observed',
      title: 'Agentic Self-Healing Cloud Platform',
      body: 'A cinematic, real-time systems visualization that detects anomalies, expands context, and restores stability with precision.',
      align: 'center',
    },
    {
      key: 'anomaly',
      start: 0.2,
      end: 0.5,
      kicker: 'Anomaly phase',
      title: 'Controlled instability. Intelligent containment.',
      body: 'Flicker, distortion, and signal drift are captured early — before impact propagates across the mesh.',
      align: 'left',
    },
    {
      key: 'analysis',
      start: 0.5,
      end: 0.75,
      kicker: 'Analysis + expansion',
      title: 'Explode the system state to reveal causality.',
      body: 'Dependencies separate in a radial unwind — exposing hot paths, bottlenecks, and hidden coupling.',
      align: 'right',
    },
    {
      key: 'resolution',
      start: 0.75,
      end: 1.0,
      kicker: 'Resolution',
      title: 'Reform. Optimize. Return to calm.',
      body: 'Services converge into a refined, stable topology — nodes recover, glow normalizes, and the platform remains in control.',
      align: 'center',
    },
  ] as const

  return (
    <section
      ref={hostRef}
      className={className}
      style={{
        height: `${scrollVh}vh`,
        background: 'linear-gradient(180deg, #050505 0%, #030712 100%)',
      }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(800px_500px_at_50%_35%,rgba(14,165,233,0.14),transparent_60%)] opacity-70" />
          <div className="absolute inset-x-0 bottom-[-20%] h-[60%] bg-[radial-gradient(700px_350px_at_50%_0%,rgba(29,78,216,0.12),transparent_65%)]" />
        </div>

        <div className="absolute inset-0">
          <div className="mx-auto flex h-full max-w-7xl px-6">
            <div className="relative h-full w-full">
              {blocks.map((b) => {
                const span = Math.max(1e-6, b.end - b.start)
                const m = span * 0.11
                const inA = b.start - m
                const inB = b.start + m
                const outA = b.end - m
                const outB = b.end + m
                const oIn = smoothstep(inA, inB, progress)
                const oOut = 1 - smoothstep(outA, outB, progress)
                const opacity = clamp01(Math.min(oIn, oOut))
                const y = (1 - easeOutCubic(opacity)) * 16
                const blur = (1 - opacity) * 8

                const alignClass =
                  b.align === 'left'
                    ? 'left-0 text-left items-start'
                    : b.align === 'right'
                      ? 'right-0 text-right items-end'
                      : 'left-1/2 -translate-x-1/2 text-center items-center'

                return (
                  <div
                    key={b.key}
                    className={`absolute top-[18%] flex w-full max-w-[56rem] flex-col gap-4 ${alignClass}`}
                    style={{
                      opacity,
                      transform: `translateY(${y}px) ${b.align === 'center' ? 'translateX(-50%)' : ''}`.trim(),
                      filter: `blur(${blur}px)`,
                      transition: 'opacity 120ms linear',
                    }}
                  >
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 backdrop-blur-xl">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5E9] shadow-[0_0_20px_rgba(14,165,233,0.55)]" />
                      <span className="text-xs tracking-wide text-white/70">{b.kicker}</span>
                    </div>

                    <h1 className="text-balance text-[2.65rem] font-semibold leading-[1.03] tracking-[-0.03em] text-white sm:text-[4.25rem]">
                      <span className="bg-gradient-to-b from-white via-white to-[#BFE8FF] bg-clip-text text-transparent">
                        {b.title}
                      </span>
                    </h1>

                    <p className="max-w-[44rem] text-pretty text-base leading-relaxed text-white/60 sm:text-lg">
                      {b.body}
                    </p>

                    {b.key === 'stable' && (
                      <div className="pointer-events-auto mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                        <a
                          href="/login"
                          className="group inline-flex items-center justify-center rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-xl transition hover:bg-white/14"
                        >
                          View platform demo
                          <span className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">
                            →
                          </span>
                        </a>
                        <a
                          href="/login"
                          className="inline-flex items-center justify-center rounded-full border border-[#60A5FA]/35 bg-[#0B1220]/30 px-5 py-2.5 text-sm font-medium text-white/90 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.06)] backdrop-blur-xl transition hover:border-[#60A5FA]/50 hover:bg-[#0B1220]/40"
                        >
                          Talk to engineering
                        </a>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {!ready && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="glass-sm flex items-center gap-3 rounded-full px-5 py-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#0EA5E9]" />
              <span className="text-sm text-white/70">Loading visualization…</span>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/55 backdrop-blur-xl">
            Scroll to evolve system state
          </div>
        </div>
      </div>
    </section>
  )
}

