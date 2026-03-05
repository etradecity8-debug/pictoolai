import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

const TOKEN_KEY = 'picaitool_token'
const USER_KEY = 'picaitool_user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const login = useCallback((token, userData) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(userData))
    setUser(userData)
  }, [])

  const refreshUser = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    const saved = localStorage.getItem(USER_KEY)
    if (!token || !saved) return Promise.resolve()
    return fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const prev = JSON.parse(saved)
        setUser({ ...prev, ...data.user })
        localStorage.setItem(USER_KEY, JSON.stringify({ ...prev, ...data.user }))
      })
      .catch(() => {})
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  const getToken = useCallback(() => localStorage.getItem(TOKEN_KEY), [])

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    const saved = localStorage.getItem(USER_KEY)
    if (!token || !saved) {
      setLoading(false)
      return
    }
    fetch('/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const value = { user, loading, login, logout, getToken, refreshUser }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
