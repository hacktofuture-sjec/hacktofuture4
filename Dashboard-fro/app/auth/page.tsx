'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Network, Mail, Lock, User, CheckCircle2, ShieldCheck,
  ArrowRight, Eye, EyeOff
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { SplineScene } from '@/components/home/SplineScene'

// Social icon SVGs
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none">
      <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
      <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
    </svg>
  )
}

// Field wrapper
function FormField({
  label, children, right,
}: {
  label: string
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <label className="text-[8px] font-bold uppercase tracking-[0.18em] text-white/35 pl-0.5">
          {label}
        </label>
        {right}
      </div>
      {children}
    </div>
  )
}

// Main page
export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [formData, setFormData] = useState({
    username: '', email: '', password: '', confirmPassword: '',
  })

  const router = useRouter()
  const { login, register } = useAuth()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(p => ({ ...p, [e.target.name]: e.target.value }))
    setMessage(null)
  }

  const switchMode = (login: boolean) => {
    setIsLogin(login)
    setMessage(null)
    setFormData({ username: '', email: '', password: '', confirmPassword: '' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      if (isLogin) {
        if (!formData.email || !formData.password) {
          setMessage({ text: 'Please fill in all fields', ok: false }); return
        }
        const ok = await login(formData.email, formData.password)
        if (ok) router.push('/dashboard')
        else setMessage({ text: 'Invalid email or password', ok: false })
      } else {
        if (!formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
          setMessage({ text: 'Please fill in all fields', ok: false }); return
        }
        if (formData.password !== formData.confirmPassword) {
          setMessage({ text: 'Passwords do not match', ok: false }); return
        }
        const ok = await register(formData.username, formData.email, formData.password)
        if (ok) {
          setMessage({ text: 'Account created! Please sign in.', ok: true })
          switchMode(true)
        } else {
          setMessage({ text: 'Email already registered', ok: false })
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const INPUT_CLS =
    'h-10 w-full rounded-xl bg-white/[0.04] border border-white/[0.07] text-xs text-white ' +
    'placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] ' +
    'transition-all duration-200 pl-9 pr-3'

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-[#020509] overflow-hidden p-4 md:p-8">

      {/* Ambient background orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-700/10 blur-[130px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-violet-800/10 blur-[130px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-blue-900/5 blur-[180px] rounded-full" />
      </div>

      {/* Main container */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[1100px] min-h-[620px] flex flex-col lg:flex-row rounded-[2.5rem] overflow-hidden border border-white/[0.06] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]"
        style={{ background: 'linear-gradient(135deg, rgba(6,9,18,0.95) 0%, rgba(8,12,24,0.98) 100%)' }}
      >

        {/* LEFT: 3D SCENE */}
        <div className="relative hidden lg:flex flex-col w-[52%] min-h-full overflow-hidden">
          {/* 3D scene fills the entire left panel */}
          <div className="absolute inset-0">
            <SplineScene
              scene="https://prod.spline.design/kZqonS6vDbv7imB6/scene.splinecode"
              className="w-full h-full"
            />
          </div>

          {/* Spotlight glow that sits behind the robot */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] rounded-full bg-blue-500/8 blur-[100px]" />
          </div>

          {/* Edge fade to blend left panel with the card's right half */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-t from-[#060912]/80 via-transparent to-[#060912]/50" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#060912]/90" />
          </div>

          {/* Centered hero heading + sparkle effect */}
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-center"
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-[-0.02em] mb-8">
                <span className="text-white">Autonomous</span>
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-blue-100 to-blue-300">
                  Infrastructure
                </span>
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-blue-200 to-cyan-200">
                  Resilience
                </span>
              </h1>

              {/* Premium sparkle effect under heading */}
              <div className="relative w-96 h-48 mx-auto">
                {/* Soft glow line at top */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-blue-400/60 to-transparent" />
                
                {/* Glow blur behind sparkles */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-24 bg-blue-400/10 blur-[40px]" />
              </div>
            </motion.div>
          </div>

          {/* Brand badge - top left */}
          <Link
            href="/"
            className="absolute top-8 left-8 z-20 flex items-center gap-2.5 group"
          >
            <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-500/25 backdrop-blur-sm shadow-[0_0_20px_rgba(59,130,246,0.2)] group-hover:border-blue-400/40 transition-colors">
              <Network className="size-4 text-blue-400" />
            </div>
            <div className="leading-none">
              <p className="text-xs font-bold text-white tracking-widest uppercase">AetherMesh</p>
              <p className="text-[9px] text-blue-400/60 tracking-[0.2em] uppercase mt-0.5">Self-healing cloud</p>
            </div>
          </Link>

          {/* Bottom caption */}
          <div className="absolute bottom-10 left-8 right-8 z-20 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.6 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-400" />
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-blue-400/70">AI Agent Online</span>
              </div>
              <p className="text-white/30 text-xs leading-relaxed">
                Autonomous anomaly detection &amp; self-healing infrastructure.
              </p>
            </motion.div>
          </div>
        </div>

        {/* RIGHT: AUTH FORM */}
        <div className="flex-1 flex flex-col justify-center p-8 sm:p-10 lg:p-12 relative">

          {/* Mobile-only brand header */}
          <Link href="/" className="flex lg:hidden items-center gap-2.5 mb-8">
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/15 border border-blue-500/25">
              <Network className="size-4 text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-white tracking-widest uppercase">AetherMesh</p>
              <p className="text-[9px] text-blue-400/60 tracking-[0.2em] uppercase">Self-healing cloud</p>
            </div>
          </Link>

          {/* Heading */}
          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? 'signin-head' : 'signup-head'}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
              className="mb-7"
            >
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-2">
                {isLogin ? 'Hello! Welcome Back' : 'Create Your Account'}
              </h1>
              <p className="text-[11px] text-white/35 leading-relaxed max-w-[340px]">
                Access the autonomous cloud platform for monitoring, anomaly detection, root cause analysis, and automated remediation.
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Tab toggle */}
          <div className="flex mb-7 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <button
              onClick={() => switchMode(true)}
              className={`flex-1 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] transition-all duration-300 ${
                isLogin
                  ? 'bg-white/10 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
                  : 'text-white/25 hover:text-white/50'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchMode(false)}
              className={`flex-1 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] transition-all duration-300 ${
                !isLogin
                  ? 'bg-white/10 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
                  : 'text-white/25 hover:text-white/50'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Status message */}
          <AnimatePresence mode="wait">
            {message && (
              <motion.div
                key="msg"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-5"
              >
                <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs border ${
                  message.ok
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  {message.ok
                    ? <CheckCircle2 className="size-3.5 shrink-0" />
                    : <ShieldCheck className="size-3.5 shrink-0" />}
                  <span>{message.text}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form fields */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {!isLogin && (
                <motion.div
                  key="full-name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <FormField label="Full Name">
                    <div className="relative group">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-white/20 group-focus-within:text-blue-400 transition-colors" />
                      <input
                        name="username"
                        autoComplete="name"
                        placeholder="Platform Operator"
                        value={formData.username}
                        onChange={handleChange}
                        className={INPUT_CLS}
                      />
                    </div>
                  </FormField>
                </motion.div>
              )}
            </AnimatePresence>

            <FormField label="Work Email">
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-white/20 group-focus-within:text-blue-400 transition-colors" />
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="operator@company.com"
                  value={formData.email}
                  onChange={handleChange}
                  className={INPUT_CLS}
                />
              </div>
            </FormField>

            <FormField
              label="Password"
              right={
                isLogin ? (
                  <button type="button" className="text-[9px] font-bold text-blue-500/80 hover:text-blue-400 transition-colors uppercase tracking-widest">
                    Forgot Password?
                  </button>
                ) : undefined
              }
            >
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-white/20 group-focus-within:text-blue-400 transition-colors" />
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  placeholder="â¢â¢â¢â¢â¢â¢â¢â¢"
                  value={formData.password}
                  onChange={handleChange}
                  className={INPUT_CLS + ' pr-9'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </FormField>

            <AnimatePresence mode="popLayout" initial={false}>
              {!isLogin && (
                <motion.div
                  key="confirm-pass"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <FormField label="Confirm Password">
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-white/20 group-focus-within:text-blue-400 transition-colors" />
                      <input
                        name="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="â¢â¢â¢â¢â¢â¢â¢â¢"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className={INPUT_CLS + ' pr-9'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirm ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                  </FormField>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="relative w-full h-9 mt-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase tracking-[0.18em] transition-all duration-200 flex items-center justify-center gap-2 group shadow-[0_10px_30px_-6px_rgba(59,130,246,0.5)] border border-blue-400/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="h-3 w-3 border-[2px] border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[9px] text-white/25 uppercase tracking-[0.2em] font-bold">or continue with</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* Social buttons */}
          <div className="flex gap-2.5">
            {[
              { label: 'Google', icon: <GoogleIcon /> },
              { label: 'GitHub', icon: <GitHubIcon /> },
              { label: 'Microsoft', icon: <MicrosoftIcon /> },
            ].map(({ label, icon }) => (
              <button
                key={label}
                type="button"
                title={`Continue with ${label}`}
                className="flex-1 h-8 flex items-center justify-center gap-2 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.07] hover:border-white/[0.12] transition-all duration-200 text-white/50 hover:text-white/80 text-[9px] font-medium"
              >
                {icon}
                <span className="hidden sm:inline text-[8px] text-white/30 font-bold uppercase tracking-widest">{label}</span>
              </button>
            ))}
          </div>

          {/* Switch mode link */}
          <p className="text-center text-[9px] text-white/20 mt-7">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => switchMode(!isLogin)}
              className="text-blue-400 hover:text-blue-300 font-bold transition-colors"
            >
              {isLogin ? 'Create Account' : 'Sign In'}
            </button>
          </p>
        </div>
      </motion.div>

      {/* Vertical divider between panels (decorative, desktop only) */}
      <div className="pointer-events-none absolute top-0 left-0 w-full h-full z-5">
      </div>
    </main>
  )
}
