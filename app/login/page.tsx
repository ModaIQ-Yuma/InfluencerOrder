'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'signup'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit() {
    setError(''); setSuccess(''); setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setError(error.message); return }
        router.push('/')
        router.refresh()
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) { setError(error.message); return }
        setSuccess('注册成功！请检查邮箱完成验证后登录。')
        setMode('login')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c0e14]">
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-2xl font-bold tracking-tight">
            ModaIQ <span style={{ color: '#6c63ff' }}>InfluencerOrder</span>
          </div>
          <div className="text-sm text-[#7e849e] mt-1">TikTok Shop 订单分析平台</div>
        </div>

        {/* Card */}
        <div className="bg-[#13151f] border border-[#2a2d45] rounded-2xl p-8">
          {/* Tab */}
          <div className="flex mb-6 bg-[#0c0e14] rounded-lg p-1">
            {(['login', 'signup'] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
                className="flex-1 py-2 text-sm rounded-md transition-all"
                style={{
                  background: mode === m ? '#6c63ff' : 'transparent',
                  color: mode === m ? '#fff' : '#7e849e',
                }}>
                {m === 'login' ? '登录' : '注册'}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <div className="text-xs text-[#7e849e] mb-1.5">邮箱</div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="you@example.com"
                className="w-full bg-[#1c1f2e] border border-[#2a2d45] rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
                style={{ color: '#dde1f0' }}
                onFocus={e => (e.target.style.borderColor = '#6c63ff')}
                onBlur={e => (e.target.style.borderColor = '#2a2d45')}
              />
            </div>
            <div>
              <div className="text-xs text-[#7e849e] mb-1.5">密码</div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="••••••••"
                className="w-full bg-[#1c1f2e] border border-[#2a2d45] rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
                style={{ color: '#dde1f0' }}
                onFocus={e => (e.target.style.borderColor = '#6c63ff')}
                onBlur={e => (e.target.style.borderColor = '#2a2d45')}
              />
            </div>

            {error && (
              <div className="text-xs text-[#e85d75] bg-[#e85d75]/10 border border-[#e85d75]/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            {success && (
              <div className="text-xs text-[#3ecf8e] bg-[#3ecf8e]/10 border border-[#3ecf8e]/20 rounded-lg px-3 py-2">
                {success}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !email || !password}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-all mt-1"
              style={{
                background: '#6c63ff',
                color: '#fff',
                opacity: loading || !email || !password ? 0.5 : 1,
              }}>
              {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
