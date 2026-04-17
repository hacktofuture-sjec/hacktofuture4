'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Activity, ShieldCheck, Cpu, Database, AlertTriangle, Zap } from 'lucide-react'

export function HeroVisualPanel() {
  return (
    <div className="relative w-full h-[500px] flex items-center justify-center pointer-events-none sm:pointer-events-auto">
      {/* Background Glow */}
      <div className="absolute -inset-10 bg-[#3B82F6]/10 blur-[100px] rounded-full z-0" />
      
      {/* Main Container for Stacked Cards */}
      <div className="relative z-10 w-full max-w-sm h-full flex items-center justify-center">
        
        {/* Card 1: System Health (Top/Main) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          whileHover={{ y: -5, transition: { duration: 0.2 } }}
          className="absolute top-4 z-30 w-full rounded-3xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-2xl shadow-2xl"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 text-left">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
                <ShieldCheck className="text-green-500 h-6 w-6" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">System Health</h3>
                <p className="text-green-500/80 text-[10px] uppercase tracking-widest font-bold">Stable & Protected</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-white tracking-tighter">98.2%</span>
              <p className="text-white/40 text-[10px]">Overall Uptime</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "98.2%" }}
                transition={{ duration: 1.5, delay: 0.5 }}
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
              />
            </div>
            <div className="flex justify-between text-[10px] text-white/40 font-medium">
              <span>PROVISIONED: 1,240 CORE</span>
              <span>UTILIZED: 842 CORE</span>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Anomaly Detection (Middle Layer) */}
        <motion.div
          initial={{ opacity: 0, x: 30, y: 50 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          whileHover={{ x: 5, transition: { duration: 0.2 } }}
          className="absolute top-40 -right-6 z-20 w-[95%] rounded-2xl border border-white/10 bg-[#0A0F1E]/40 p-5 backdrop-blur-xl shadow-xl"
        >
          <div className="flex items-center gap-3 mb-4 text-left">
            <div className="relative">
              <div className="h-8 w-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center border border-[#3B82F6]/20">
                <Activity className="text-[#3B82F6] h-5 w-5" />
              </div>
              <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-[#3B82F6]/20 rounded-lg"
              />
            </div>
            <div>
              <h3 className="text-white text-xs font-medium">Anomaly Engine</h3>
              <p className="text-[#3B82F6] text-[9px] font-bold">SCANNING CLUSTER_01</p>
            </div>
          </div>
          
          <div className="relative h-12 bg-white/5 rounded-lg border border-white/5 overflow-hidden flex items-end gap-1 px-2 pb-1">
             {[40, 70, 45, 90, 65, 30, 80, 55, 75, 50, 85, 40].map((h, i) => (
               <motion.div 
                 key={i}
                 initial={{ height: 0 }}
                 animate={{ height: `${h}%` }}
                 transition={{ duration: 1, delay: 0.3 + (i * 0.05) }}
                 className="flex-1 bg-[#3B82F6]/30 rounded-t-[1px]"
               />
             ))}
             {/* Scanning Line */}
             <motion.div 
               animate={{ left: ["0%", "100%", "0%"] }}
               transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
               className="absolute top-0 bottom-0 w-[1px] bg-blue-400 shadow-[0_0_10px_#3B82F6] z-10"
             />
          </div>
        </motion.div>

        {/* Card 3: AI Insights / Automated Remediation (Bottom Layer) */}
        <motion.div
          initial={{ opacity: 0, x: -40, y: 80 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          whileHover={{ x: -5, transition: { duration: 0.2 } }}
          className="absolute top-72 -left-10 z-10 w-[90%] rounded-2xl border border-white/10 bg-[#0A0F1E]/60 p-5 backdrop-blur-xl shadow-lg"
        >
          <div className="flex items-center gap-2 mb-3 text-left">
             <Zap className="text-amber-400 h-4 w-4" />
             <span className="text-white/80 text-[10px] font-bold uppercase tracking-wider">AI Self-Healing Actions</span>
          </div>
          
          <div className="space-y-3">
            {[
              { label: 'POD_RESTART', target: 'order-service-v2', time: '2m ago', color: 'text-blue-400' },
              { label: 'AUTO_SCALE', target: 'auth-api', time: '12m ago', color: 'text-purple-400' }
            ].map((action, i) => (
              <div key={i} className="flex items-center justify-between group">
                <div className="flex flex-col text-left">
                  <span className={`text-[10px] font-bold ${action.color}`}>{action.label}</span>
                  <span className="text-[9px] text-white/40">{action.target}</span>
                </div>
                <span className="text-[8px] text-white/20 italic group-hover:text-white/40 transition-colors">
                  {action.time}
                </span >
              </div>
            ))}
          </div>
        </motion.div>

        {/* Floating Metrics Tags */}
        <motion.div 
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-6 -left-20 bg-white/5 border border-white/10 rounded-full px-3 py-1 backdrop-blur-lg flex items-center gap-2"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[9px] text-white/60 font-medium">Nodes: 12 Active</span>
        </motion.div>

        <motion.div 
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-12 -right-24 bg-white/5 border border-white/10 rounded-full px-3 py-1 backdrop-blur-lg flex items-center gap-2"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-[9px] text-white/60 font-medium">Latency: 12ms</span>
        </motion.div>
      </div>
    </div>
  )
}
