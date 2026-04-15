'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Activity, Shield, Cpu, Play } from 'lucide-react'
import Link from 'next/link'

export function LiquidMetalHero() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1, ease: [0.16, 1, 0.3, 1] },
    },
  }

  return (
    <section className="relative flex min-h-[100vh] w-full items-center justify-center overflow-hidden bg-[#030712] py-24">
      {/* Liquid Metal Animated Background Overlay */}
      <div className="absolute inset-0 z-0">
        <svg 
          className="h-full w-full opacity-30 grayscale filter mix-blend-overlay" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="liquid-filter">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.012" numOctaves="4" seed="5">
              <animate attributeName="baseFrequency" dur="25s" values="0.012 0.012; 0.018 0.024; 0.012 0.012" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="50" />
          </filter>
          <rect width="100%" height="100%" filter="url(#liquid-filter)" fill="#05080f" />
        </svg>
        
        {/* Glow Effects */}
        <div className="absolute -left-20 top-0 h-[600px] w-[600px] rounded-full bg-[#1D4ED8]/10 blur-[140px]" />
        <div className="absolute -right-20 bottom-0 h-[600px] w-[600px] rounded-full bg-[#0EA5E9]/10 blur-[140px]" />
        
        <div className="absolute inset-0 bg-gradient-to-b from-[#030712]/0 via-[#030712]/40 to-[#030712]" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto max-w-7xl px-6 text-center"
      >
        <motion.div variants={itemVariants} className="mb-10 flex justify-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 py-1.5 pl-4 pr-5 backdrop-blur-2xl">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0EA5E9] opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0EA5E9]"></span>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/80">
              Next-Gen Cloud Reliability
            </span>
          </div>
        </motion.div>

        <motion.h1
          variants={itemVariants}
          className="mx-auto max-w-[800px] text-2xl font-bold tracking-tight text-white mb-5 sm:text-4xl lg:text-5xl leading-[1.1]"
        >
          AI Agents That Detect, Diagnose, and <span className="bg-gradient-to-r from-[#0EA5E9] via-blue-400 to-[#1D4ED8] bg-clip-text text-transparent">Heal Kubernetes Failures</span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="mx-auto max-w-xl text-sm leading-relaxed text-white/50 sm:text-base font-light"
        >
          An intelligent cloud operations platform that continuously ingests logs, metrics, and traces, detects anomalies in real time, identifies root causes across distributed services, and executes automated remediation to reduce downtime and improve resilience.
        </motion.p>

        <motion.div 
          variants={itemVariants} 
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Link href="/dashboard">
            <Button 
              size="sm" 
              className="h-11 rounded-full bg-white px-7 text-sm font-semibold text-black transition-all hover:scale-105 hover:bg-white/95"
            >
              Launch Dashboard
            </Button>
          </Link>
          <Link href="#capabilities">
            <Button 
              size="sm" 
              variant="outline" 
              className="h-11 rounded-full border-white/15 bg-white/5 px-7 text-sm font-semibold text-white backdrop-blur-xl transition-all hover:scale-105 hover:bg-white/10"
            >
              <Play className="mr-2.5 h-3.5 w-3.5 fill-white/10" />
              See How It Works
            </Button>
          </Link>
        </motion.div>

        {/* Feature Grid */}
        <motion.div
          variants={itemVariants}
          className="mt-28 grid grid-cols-1 gap-6 md:grid-cols-3"
        >
          {[
            { 
              title: 'Continuous Observability', 
              icon: Activity, 
              desc: 'Seamless telemetry ingestion across your entire cluster surface.' 
            },
            { 
              title: 'Context-Aware Root Cause Analysis', 
              icon: Cpu, 
              desc: 'AI-driven causality mapping across distributed service meshes.' 
            },
            { 
              title: 'Closed-Loop Automated Recovery', 
              icon: Shield, 
              desc: 'Self-healing actions that remediate failures before they impact users.' 
            }
          ].map((feature, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-9 text-left backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/[0.06]"
            >
              <div className="absolute -right-6 -top-6 h-32 w-32 bg-blue-500/5 blur-[50px] transition-all group-hover:bg-blue-500/10" />
              <div className="mb-7 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0EA5E9]/20 to-[#1D4ED8]/20 text-[#0EA5E9] ring-1 ring-white/10">
                <feature.icon size={24} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-semibold text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">
                {feature.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-white/50 font-light">
                {feature.desc}
              </p>
              
              {/* Subtle hover indicator */}
              <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r from-transparent via-[#0EA5E9] to-transparent transition-all duration-500 group-hover:w-full" />
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Decorative gradient blur at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#030712] to-transparent z-10" />
    </section>
  )
}
