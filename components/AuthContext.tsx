'use client'
import { createContext, useContext, useState, ReactNode } from 'react'

// 上传密码验证状态（存 sessionStorage，刷新后需重新输入）
// 与 Supabase 登录状态分开：Supabase 管身份认证，这里管上传权限
const KEY = 'fs_upload_pw'

const AuthContext = createContext<{
  password: string
  setPassword: (p: string) => void
  authed: boolean
  setAuthed: (a: boolean) => void
}>({ password: '', setPassword: () => {}, authed: false, setAuthed: () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [password, setPasswordState] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return sessionStorage.getItem(KEY) || ''
  })
  const [authed, setAuthedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return !!sessionStorage.getItem(KEY)
  })

  function setPassword(p: string) {
    setPasswordState(p)
    if (p) sessionStorage.setItem(KEY, p)
    else sessionStorage.removeItem(KEY)
  }

  function setAuthed(a: boolean) {
    setAuthedState(a)
    if (!a) {
      sessionStorage.removeItem(KEY)
      setPasswordState('')
    }
  }

  return (
    <AuthContext.Provider value={{ password, setPassword, authed, setAuthed }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
