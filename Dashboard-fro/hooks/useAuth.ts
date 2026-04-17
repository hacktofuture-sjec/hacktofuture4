import { useState, useCallback, useEffect } from 'react'

interface User {
  id: string
  username: string
  email: string
  avatar?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (username: string, email: string, password: string) => Promise<boolean>
  logout: () => void
  isLoading: boolean
}

// In-memory storage for demo
const users = new Map<string, { username: string; email: string; password: string; id: string; avatar?: string }>()
const sessions = new Map<string, string>()

// Initialize with demo user
function initializeDemoUser() {
  if (users.size === 0) {
    users.set('demo@microchat.app', {
      id: 'user-1',
      username: 'Demo User',
      email: 'demo@microchat.app',
      password: 'demo123', // In real app, this would be hashed
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
    })
  }
}

export function useAuth(): AuthContextType {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Check if user is already logged in
  useEffect(() => {
    initializeDemoUser()
    const token = localStorage.getItem('auth_token')
    if (token) {
      const userId = sessions.get(token)
      if (userId) {
        const userFromMap = Array.from(users.values()).find(u => u.id === userId)
        if (userFromMap) {
          setUser({
            id: userFromMap.id,
            username: userFromMap.username,
            email: userFromMap.email,
            avatar: userFromMap.avatar,
          })
          setIsAuthenticated(true)
        }
      }
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const userRecord = users.get(email)
        if (userRecord && userRecord.password === password) {
          const token = `token_${Date.now()}`
          sessions.set(token, userRecord.id)
          localStorage.setItem('auth_token', token)
          
          setUser({
            id: userRecord.id,
            username: userRecord.username,
            email: userRecord.email,
            avatar: userRecord.avatar,
          })
          setIsAuthenticated(true)
          resolve(true)
        } else {
          resolve(false)
        }
      }, 500)
    })
  }, [])

  const register = useCallback(async (username: string, email: string, password: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (users.has(email)) {
          resolve(false)
        } else {
          const id = `user_${Date.now()}`
          users.set(email, {
            id,
            username,
            email,
            password,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
          })
          resolve(true)
        }
      }, 500)
    })
  }, [])

  const logout = useCallback(() => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      sessions.delete(token)
      localStorage.removeItem('auth_token')
    }
    setUser(null)
    setIsAuthenticated(false)
  }, [])

  return {
    user,
    isAuthenticated,
    login,
    register,
    logout,
    isLoading,
  }
}
