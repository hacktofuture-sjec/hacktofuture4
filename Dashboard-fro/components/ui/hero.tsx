"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Plus, ArrowRight, ShieldCheck, Zap, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroVisualPanel } from "@/components/home/HeroVisualPanel";
import { renderCanvas } from "@/components/ui/canvas";

import { useAuth } from "@/hooks/useAuth";

export function Hero() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    renderCanvas();
  }, []);

  return (
    <section id="home" className="relative overflow-hidden min-h-screen flex flex-col items-center justify-center bg-black pt-12 md:pt-14">
      {/* Canvas Background */}
      <canvas
        id="canvas"
        className="pointer-events-none absolute inset-0 w-full h-full z-0"
      />
      
      <div className="relative z-10 animation-delay-8 animate-fadeIn flex flex-col items-center justify-center px-4 w-full max-w-7xl mx-auto mt-2 md:mt-4">
        <div className="mb-14 w-full">
          <div className="px-2">
            <div className="relative mx-auto h-full max-w-6xl rounded-[2.5rem] border border-white/10 p-8 md:p-14 lg:p-12 bg-white/[0.02] backdrop-blur-[2px] shadow-2xl overflow-hidden">
               {/* Corner Accents */}
               <Plus className="text-[#3B82F6]/40 absolute -left-4 -top-4 h-8 w-8" />
               <Plus className="text-[#3B82F6]/40 absolute -bottom-4 -left-4 h-8 w-8" />
               <Plus className="text-[#3B82F6]/40 absolute -right-4 -top-4 h-8 w-8" />
               <Plus className="text-[#3B82F6]/40 absolute -bottom-4 -right-4 h-8 w-8" />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                {/* Left Side: Content */}
                <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-6">
                  {/* Badge */}
                  <div className="z-10">
                    <div className="relative flex items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/5 pr-4 pl-1.5 py-1.5 text-xs leading-6 text-white/70 backdrop-blur-xl transition hover:border-white/20">
                      <span className="flex items-center gap-1.5 rounded-full bg-[#3B82F6]/20 px-2.5 py-0.5 font-bold text-[#3B82F6] uppercase tracking-wider text-[10px]">
                        AI-Powered Kubernetes Reliability
                      </span>
                      <Link
                        href={isAuthenticated ? "#capabilities" : "/auth"}
                        className="group flex items-center font-medium transition-colors hover:text-white"
                      >
                        Explore Platform
                        <ArrowRight className="h-3.5 w-3.5 ml-1.5 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>
                  </div>

                  <h1 className="select-none text-xl font-bold leading-[1.1] tracking-[0.2em] text-white md:text-3xl lg:text-4xl uppercase max-w-xl">
                    Autonomous Self-Healing for <span className="bg-gradient-to-r from-[#60A5FA] via-[#818CF8] to-[#3B82F6] bg-clip-text text-transparent">Modern Cloud Infrastructure</span>
                  </h1>
                  
                  <p className="max-w-xl text-sm leading-relaxed text-white/60 md:text-base font-light">
                    An AI-driven platform for real-time monitoring, anomaly detection, root cause analysis, and automated remediation.
                  </p>

                  <div className="flex items-center justify-center gap-2 rounded-full bg-white/[0.03] border border-white/5 px-4 py-1.5 transition hover:bg-white/[0.05]">
                    <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_10_rgba(34,197,94,0.5)]"></span>
                    </span>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-green-500">Autonomous Detection Enabled</p>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4 pt-4 w-full sm:w-auto">
                    <Link href={isAuthenticated ? "/dashboard" : "/auth"} className="w-full sm:w-auto">
                      <Button size="lg" className="w-full h-11 rounded-full bg-white px-8 text-sm font-bold text-black hover:bg-white/90 transition-transform hover:scale-105 active:scale-95">
                        <Zap className="h-4 w-4 mr-2 fill-current" />
                        Launch Dashboard
                      </Button>
                    </Link>
                    <Link href={isAuthenticated ? "#capabilities" : "/auth"} className="w-full sm:w-auto">
                      <Button variant="outline" size="lg" className="w-full h-11 rounded-full border-white/10 bg-white/5 px-8 text-sm font-bold text-white backdrop-blur-xl hover:bg-white/10 transition-transform hover:scale-105 active:scale-95">
                        <Activity className="h-4 w-4 mr-2" />
                        {isAuthenticated ? "View Workflow" : "Get Started"}
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Right Side: Visual Panel */}
                <div className="relative w-full flex justify-center lg:justify-end">
                   <HeroVisualPanel />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 space-y-6 text-center">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-[#3B82F6]/80 px-4">
              Built for cloud-native teams managing complex Kubernetes environments
            </h2>

            <p className="mx-auto max-w-3xl px-6 text-[15px] leading-relaxed text-white/45 sm:px-6 md:max-w-4xl md:px-20 lg:text-[17px] font-light italic">
              SolutionSync transforms reactive infrastructure management into a continuous closed-loop system for observability, diagnosis, and self-healing remediation. Designed for distributed microservices, it helps teams reduce MTTR, prevent cascading failures, and scale with confidence.
            </p>
          </div>
        </div>
      </div>
      
      {/* Decorative Gradients */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[800px] bg-[#1E3A8A]/20 blur-[150px] opacity-30 rounded-full" />
      </div>
    </section>
  );
};
