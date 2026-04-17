'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  
  const router = useRouter()
  const { login, register } = useAuth()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mode = params.get('mode')
    if (mode === 'signup') setIsLogin(false)
    if (mode === 'signin') setIsLogin(true)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isLogin) {
        // Login
        if (!formData.email || !formData.password) {
          setError('Please fill in all fields')
          return
        }
        const success = await login(formData.email, formData.password)
        if (success) {
          router.push('/dashboard')
        } else {
          setError('Invalid credentials')
        }
      } else {
        // Register
        if (!formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
          setError('Please fill in all fields')
          return
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match')
          return
        }
        const success = await register(formData.username, formData.email, formData.password)
        if (success) {
          router.push('/dashboard')
        } else {
          setError('Registration failed')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={18} />
          Back to Home
        </Link>

        <Card className="glass p-8 rounded-xl border border-border/40 space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold gradient-text">SolutionSync</h1>
            <p className="text-sm text-muted-foreground">
              {isLogin ? 'Sign in to your account' : 'Create a new account'}
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/30">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="johndoe"
                  disabled={loading}
                  className="glass-sm"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="demo@microchat.app"
                disabled={loading}
                className="glass-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                disabled={loading}
                className="glass-sm"
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  disabled={loading}
                  className="glass-sm"
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold h-10 rounded-lg"
            >
              {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/20" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-background text-muted-foreground">Or</span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              setFormData({
                username: 'Demo User',
                email: 'demo@microchat.app',
                password: 'demo123',
                confirmPassword: 'demo123',
              })
              setError('')
              // Auto-fill for demo
              setTimeout(() => {
                const form = new Event('submit', { bubbles: true })
                document.querySelector('form')?.dispatchEvent(form)
              }, 100)
            }}
            className="w-full rounded-lg"
          >
            Use Demo Account
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin)
                setError('')
                setFormData({
                  username: '',
                  email: '',
                  password: '',
                  confirmPassword: '',
                })
              }}
              className="text-primary hover:underline font-medium"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Protected by enterprise-grade security
        </p>
      </div>
    </div>
  )
}
