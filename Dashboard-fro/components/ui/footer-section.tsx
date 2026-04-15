"use client";

import React from "react";
import type { ComponentProps, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { 
  Github, 
  Linkedin, 
  Twitter, 
  Network, 
  ArrowRight
} from "lucide-react";
import Link from "next/link";

interface FooterLink {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface FooterSection {
  label: string;
  links: FooterLink[];
}

const footerLinks: FooterSection[] = [
  {
    label: "Platform",
    links: [
      { title: "Overview", href: "/#capabilities" },
      { title: "Dashboard", href: "/dashboard" },
      { title: "Service Topology", href: "/dashboard" },
      { title: "Remediation", href: "/anomalies" },
    ],
  },
  {
    label: "Capabilities",
    links: [
      { title: "Real-Time Monitoring", href: "/#capabilities" },
      { title: "Anomaly Detection", href: "/anomalies" },
      { title: "Root Cause Analysis", href: "/anomalies" },
      { title: "Automated Recovery", href: "/anomalies" },
    ],
  },
  {
    label: "Security",
    links: [
      { title: "Infrastructure Reliability", href: "/#security" },
      { title: "Incident Response", href: "/anomalies" },
      { title: "Compliance", href: "/#security" },
      { title: "Privacy Policy", href: "/auth" },
    ],
  },
  {
    label: "Contact",
    links: [
      { title: "Support", href: "/auth" },
      { title: "General Inquiries", href: "/auth" },
      { title: "Email / Contact", href: "/auth" },
      { title: "Request Access", href: "/auth" },
    ],
  },
];

const socialLinks = [
  { icon: Twitter, href: "#" },
  { icon: Github, href: "#" },
  { icon: Linkedin, href: "#" },
];

export function Footer() {
  return (
    <footer className="relative w-full border-t border-white/5 bg-[#030712] px-6 py-12 lg:py-20 overflow-hidden bg-[radial-gradient(35%_128px_at_50%_0%,rgba(59,130,246,0.08),transparent)]">
      {/* Glassy Top Border Accent */}
      <div className="absolute top-0 right-1/2 left-1/2 h-px w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/20 blur-[2px]" />
      <div className="absolute top-0 right-1/2 left-1/2 h-px w-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-blue-500/10 to-transparent" />
      
      <div className="mx-auto max-w-7xl relative z-10">
        <div className="grid w-full gap-12 lg:grid-cols-4 xl:grid-cols-5">
          {/* Brand Column */}
          <AnimatedContainer className="lg:col-span-1 xl:col-span-2 space-y-6">
            <Link href="/" className="group flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl transition-all group-hover:border-blue-500/50 group-hover:bg-blue-500/10 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <Network className="size-5 text-blue-500 transition-transform group-hover:scale-110" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-[-0.02em] text-white">
                  AetherMesh
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold group-hover:text-blue-400/50 transition-colors">
                  Self-healing cloud
                </span>
              </div>
            </Link>

            <p className="text-xs leading-relaxed text-white/40 max-w-xs font-light">
              SolutionSync transforms reactive infrastructure management into a continuous closed-loop system for AI-driven observability and autonomous self-healing remediation.
            </p>

            <div className="flex items-center gap-3">
              {socialLinks.map((social, i) => (
                <Link
                  key={i}
                  href={social.href}
                  className="flex size-9 items-center justify-center rounded-lg bg-white/[0.03] border border-white/5 text-white/30 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all hover:-translate-y-1"
                >
                  <social.icon className="size-4" />
                </Link>
              ))}
            </div>
            
            <p className="text-[10px] text-white/20 mt-8 tracking-wider">
              © {new Date().getFullYear()} AETHERMESH. ALL RIGHTS RESERVED.
            </p>
          </AnimatedContainer>

          {/* Link Columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-3 xl:mt-2">
            {footerLinks.map((section, index) => (
              <AnimatedContainer key={section.label} delay={0.1 + index * 0.1}>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70 mb-8">
                  {section.label}
                </h3>
                <ul className="space-y-4">
                  {section.links.map((link) => (
                    <li key={link.title}>
                      <Link
                        href={link.href}
                        className="text-xs text-white/40 hover:text-blue-400 transition-colors flex items-center group/link whitespace-nowrap"
                      >
                        {link.title}
                        <ArrowRight className="size-2.5 ml-1.5 opacity-0 -translate-x-2 transition-all duration-300 group-hover/link:opacity-100 group-hover/link:translate-x-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </AnimatedContainer>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

type ViewAnimationProps = {
  delay?: number;
  className?: ComponentProps<typeof motion.div>["className"];
  children: ReactNode;
};

function AnimatedContainer({ className, delay = 0.1, children }: ViewAnimationProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
