'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import ProductsPage from '@/components/ProductsPage'
import AnalysisPage from '@/components/AnalysisPage'
import OverviewPage from '@/components/OverviewPage'
import ProductCreatorPage from '@/components/ProductCreatorPage'
import CreatorAnalysisPage from '@/components/CreatorAnalysisPage'
import BDRankPage from '@/components/BDRankPage'
import type { Product, DailyEntry, CreatorDaily, CreatorCommission, BDMember, BDAssignment, BDMode } from '@/lib/types'

type Tab = 'overview' | 'analysis' | 'product-creator' | 'creator-analysis' | 'bd-rank' | 'products'
type LoadState = 'idle' | 'phase1' | 'phase2' | 'done' | 'error'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',         label: '全产品看板' },
  { id: 'analysis',         label: '单品分析' },
  { id: 'product-creator',  label: '产品达人' },
  { id: 'creator-analysis', label: '达人分析' },
  { id: 'bd-rank',          label: 'BD 排行榜' },
  { id: 'products',         label: '商品档案' },
]

// Tab 需要 phase2 数据的
const PHASE2_TABS: Tab[] = ['analysis', 'product-creator', 'creator-analysis', 'bd-rank']

export default function Home() {
  const [tab, setTab] = useState<Tab>('overview')
  const [products, setProducts] = useState<Product[]>([])
  const [daily, setDaily] = useState<DailyEntry[]>([])
  const [creatorDaily, setCreatorDaily] = useState<CreatorDaily[]>([])
  const [creatorCommission, setCreatorCommission] = useState<CreatorCommission[]>([])
  const [bdMembers, setBdMembers] = useState<BDMember[]>([])
  const [bdAssignments, setBdAssignments] = useState<BDAssignment[]>([])
  const [bdMode, setBdMode] = useState<BDMode | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [userEmail, setUserEmail] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const phase2Done = useRef(false)

  // Phase 1：轻量首屏
  const fetchPhase1 = useCallback(async () => {
    setLoadState('phase1')
    phase2Done.current = false
    try {
      const res = await fetch('/api/data?phase=1')
      if (res.status === 401) { router.push('/login'); return }
      const d = await res.json()
      setProducts(d.products || [])
      setDaily(d.daily || [])
      setBdMembers(d.bdMembers || [])
      setBdAssignments(d.bdAssignments || [])
      setBdMode(d.bdMode || null)
      setLoadState('phase2')
      fetchPhase2(d.daily || [])
    } catch {
      setLoadState('error')
    }
  }, [router])

  // Phase 2：价格档 + 达人数据（后台静默）
  const fetchPhase2 = useCallback(async (existingDaily: DailyEntry[]) => {
    try {
      const res = await fetch('/api/data?phase=2')
      const d = await res.json()
      // 把价格档合并进 daily
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const priceMap: Record<string, Record<string, any>> = d.priceMap || {}
      setDaily(existingDaily.map(entry => ({
        ...entry,
        prices: priceMap[`${entry.product_id}__${entry.date}`] || {},
      })))
      setCreatorDaily(d.creatorDaily || [])
      setCreatorCommission(d.creatorCommission || [])
      phase2Done.current = true
      setLoadState('done')
    } catch {
      setLoadState('done') // phase2 失败不阻断使用
    }
  }, [])

  // 完整刷新（上传后）
  const fetchData = useCallback(async () => {
    await fetchPhase1()
  }, [fetchPhase1])

  // 切到需要 phase2 数据的 Tab 时，如果还没加载完，显示加载中
  const phase2Loading = loadState === 'phase2' && PHASE2_TABS.includes(tab)

  // BD 数据单独刷新
  const fetchBD = useCallback(async () => {
    const res = await fetch('/api/bd')
    const d = await res.json()
    setBdMembers(d.members || [])
    setBdAssignments(d.assignments || [])
    setBdMode(d.bd_mode || null)
  }, [])

  const optimisticSetMode = useCallback((mode: BDMode) => {
    setBdMode(mode)
    fetch('/api/bd', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'set_mode', mode }) })
  }, [])

  const optimisticAddMember = useCallback((name: string, tempId: string) => {
    setBdMembers(prev => [...prev, { id: tempId, name }])
    fetch('/api/bd', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add_member', name }) })
      .then(r => r.json()).then(d => { if (d.member) setBdMembers(prev => prev.map(m => m.id === tempId ? d.member : m)) })
  }, [])

  const optimisticDeleteMember = useCallback((id: string) => {
    setBdMembers(prev => prev.filter(m => m.id !== id))
    setBdAssignments(prev => prev.filter(a => a.bd_id !== id))
    fetch('/api/bd', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'delete_member', id }) })
  }, [])

  const optimisticRenameMember = useCallback((id: string, name: string) => {
    setBdMembers(prev => prev.map(m => m.id === id ? { ...m, name } : m))
    fetch('/api/bd', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'rename_member', id, name }) })
  }, [])

  const optimisticAssign = useCallback((creator: string, product_id: string | null, bd_id: string) => {
    setBdAssignments(prev => {
      const filtered = prev.filter(a => !(a.creator === creator && a.product_id === product_id))
      if (!bd_id) return filtered
      return [...filtered, { id: `tmp-${Date.now()}`, creator, product_id, bd_id }]
    })
    fetch('/api/bd', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'assign', creator, product_id, bd_id }) })
  }, [])

  useEffect(() => {
    fetchPhase1()
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || ''))
  }, [fetchPhase1, supabase.auth])

  async function handleLogout() {
    await fetch('/api/auth', { method: 'POST' })
    await supabase.auth.signOut()
    router.push('/login')
  }

  const loadLabel = loadState === 'phase1' ? '加载概览...' : loadState === 'phase2' ? '加载详情...' : ''

  return (
    <div className="min-h-screen bg-[#0c0e14] text-[#dde1f0]" style={{ fontFamily: '-apple-system, sans-serif' }}>
      <nav className="sticky top-0 z-50 flex items-center px-6 bg-[#13151f] border-b border-[#2a2d45]" style={{ height: 52 }}>
        <span className="text-[15px] font-bold mr-8 tracking-tight">
          ModaIQ <span className="text-[#6c63ff]">InfluencerOrder</span>
        </span>

        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 text-sm border-b-2 transition-all h-full ${tab === t.id ? 'text-[#dde1f0] border-[#6c63ff]' : 'text-[#7e849e] border-transparent hover:text-[#dde1f0]'}`}>
            {t.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-3">
          {loadLabel && (
            <div className="flex items-center gap-2 text-xs text-[#444870]">
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              {loadLabel}
            </div>
          )}
          <div className="relative">
            <button onClick={() => setShowUserMenu(v => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-[#7e849e] hover:text-[#dde1f0] hover:bg-[#1c1f2e] transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              {userEmail}
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-[#13151f] border border-[#2a2d45] rounded-xl shadow-xl z-50 overflow-hidden">
                <UserMenu
                  bdMode={bdMode}
                  bdMembers={bdMembers}
                  onSetMode={optimisticSetMode}
                  onAddMember={optimisticAddMember}
                  onDeleteMember={optimisticDeleteMember}
                  onRenameMember={optimisticRenameMember}
                  onClose={() => setShowUserMenu(false)}
                />
                <div className="border-t border-[#2a2d45]">
                  <button onClick={handleLogout}
                    className="w-full text-left px-4 py-3 text-sm text-[#e85d75] hover:bg-[#1c1f2e] transition-all">
                    退出登录
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Phase2 加载中提示 */}
      {phase2Loading && (
        <div className="flex items-center justify-center h-[calc(100vh-52px)]">
          <div className="flex flex-col items-center gap-3 text-[#444870]">
            <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <span className="text-sm">正在加载详情数据...</span>
          </div>
        </div>
      )}

      {!phase2Loading && (
        <>
          {tab === 'overview'         && <OverviewPage products={products} daily={daily} />}
          {tab === 'analysis'         && <AnalysisPage products={products} daily={daily} onDataRefresh={fetchData} />}
          {tab === 'product-creator'  && <ProductCreatorPage products={products} creatorDaily={creatorDaily} creatorCommission={creatorCommission} />}
          {tab === 'creator-analysis' && <CreatorAnalysisPage products={products} creatorDaily={creatorDaily} bdMembers={bdMembers} bdAssignments={bdAssignments} bdMode={bdMode} onAssign={optimisticAssign} />}
          {tab === 'bd-rank'          && <BDRankPage products={products} creatorDaily={creatorDaily} bdMembers={bdMembers} bdAssignments={bdAssignments} bdMode={bdMode} />}
          {tab === 'products'         && <ProductsPage onDataRefresh={fetchData} />}
        </>
      )}
    </div>
  )
}

// ── 右上角菜单 ──────────────────────────────────────────────
function UserMenu({ bdMode, bdMembers, onSetMode, onAddMember, onDeleteMember, onRenameMember, onClose }: {
  bdMode: BDMode | null
  bdMembers: BDMember[]
  onSetMode: (mode: BDMode) => void
  onAddMember: (name: string, tempId: string) => void
  onDeleteMember: (id: string) => void
  onRenameMember: (id: string, name: string) => void
  onClose: () => void
}) {
  const [section, setSection] = useState<'main' | 'password' | 'bd-mode' | 'bd-members'>('main')

  if (section === 'password')   return <PasswordPanel onBack={() => setSection('main')} onClose={onClose} />
  if (section === 'bd-mode')    return <BDModePanel current={bdMode} onBack={() => setSection('main')} onSetMode={onSetMode} />
  if (section === 'bd-members') return <BDMembersPanel members={bdMembers} onBack={() => setSection('main')} onAddMember={onAddMember} onDeleteMember={onDeleteMember} onRenameMember={onRenameMember} />

  const BD_MODE_LABELS: Record<string, string> = { creator: '按达人', product: '按产品', both: '按达人×产品' }

  return (
    <div className="py-1">
      {[
        { label: '上传密码', sub: '设置数据上传密码', action: () => setSection('password') },
        { label: 'BD 分配模式', sub: bdMode ? BD_MODE_LABELS[bdMode] : '未设置', action: () => setSection('bd-mode') },
        { label: '人员管理', sub: `${bdMembers.length} 位 BD`, action: () => setSection('bd-members') },
      ].map(item => (
        <button key={item.label} onClick={item.action}
          className="w-full text-left px-4 py-3 hover:bg-[#1c1f2e] transition-all flex items-center justify-between">
          <div>
            <div className="text-sm text-[#dde1f0]">{item.label}</div>
            <div className="text-xs text-[#444870] mt-0.5">{item.sub}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#444870" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      ))}
    </div>
  )
}

function PanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2a2d45]">
      <button onClick={onBack} className="text-[#7e849e] hover:text-[#dde1f0] transition-all">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span className="text-sm font-semibold">{title}</span>
    </div>
  )
}

function PasswordPanel({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const [pw, setPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function save() {
    if (!pw || pw.length < 4) { setMsg('至少4位'); return }
    setSaving(true)
    const res = await fetch('/api/upload-password', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    })
    setSaving(false)
    if (res.ok) { setMsg('已保存'); setPw(''); setTimeout(() => { setMsg(''); onClose() }, 800) }
    else { const d = await res.json(); setMsg(d.error || '保存失败') }
  }

  return (
    <div>
      <PanelHeader title="上传密码" onBack={onBack} />
      <div className="p-4 flex flex-col gap-3">
        <input type="password" value={pw} onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()} placeholder="设置新密码（至少4位）"
          className="w-full bg-[#1c1f2e] border border-[#2a2d45] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6c63ff]"
          style={{ color: '#dde1f0' }} />
        {msg && <div className={`text-xs ${msg === '已保存' ? 'text-[#3ecf8e]' : 'text-[#e85d75]'}`}>{msg}</div>}
        <button onClick={save} disabled={saving}
          className="w-full py-2 bg-[#6c63ff] text-white text-sm rounded-lg hover:opacity-85 disabled:opacity-50">
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}

function BDModePanel({ current, onBack, onSetMode }: { current: BDMode | null; onBack: () => void; onSetMode: (mode: BDMode) => void }) {
  const MODES: { value: BDMode; label: string; desc: string }[] = [
    { value: 'creator', label: '按达人分配', desc: '一个达人归属一个 BD，跨产品统计' },
    { value: 'product', label: '按产品分配', desc: '一个产品归属一个 BD，跨达人统计' },
    { value: 'both',    label: '按达人×产品', desc: '最细粒度，同一达人不同产品可归不同 BD' },
  ]

  return (
    <div>
      <PanelHeader title="BD 分配模式" onBack={onBack} />
      <div className="p-4 flex flex-col gap-2">
        {MODES.map(m => (
          <button key={m.value} onClick={() => onSetMode(m.value)}
            className={`w-full text-left px-3 py-3 rounded-xl border transition-all ${current === m.value ? 'border-[#6c63ff] bg-[rgba(108,99,255,0.1)]' : 'border-[#2a2d45] hover:border-[#363a58]'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#dde1f0]">{m.label}</span>
              {current === m.value && <span className="text-[#6c63ff] text-xs">当前</span>}
            </div>
            <div className="text-xs text-[#444870] mt-1">{m.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function BDMembersPanel({ members, onBack, onAddMember, onDeleteMember, onRenameMember }: {
  members: BDMember[]
  onBack: () => void
  onAddMember: (name: string, tempId: string) => void
  onDeleteMember: (id: string) => void
  onRenameMember: (id: string, name: string) => void
}) {
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState('')
  const [editName, setEditName] = useState('')

  function addMember() {
    if (!newName.trim()) return
    onAddMember(newName.trim(), `tmp-${Date.now()}`)
    setNewName('')
  }

  function renameMember(id: string) {
    if (!editName.trim()) return
    onRenameMember(id, editName.trim())
    setEditId(''); setEditName('')
  }

  return (
    <div>
      <PanelHeader title="人员管理" onBack={onBack} />
      <div className="p-4">
        <div className="flex gap-2 mb-4">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMember()}
            placeholder="BD 姓名"
            className="flex-1 bg-[#1c1f2e] border border-[#2a2d45] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6c63ff]"
            style={{ color: '#dde1f0' }} />
          <button onClick={addMember} disabled={!newName.trim()}
            className="px-3 py-2 bg-[#6c63ff] text-white text-xs rounded-lg hover:opacity-85 disabled:opacity-50 whitespace-nowrap">
            添加
          </button>
        </div>
        <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-2 px-3 py-2 bg-[#1c1f2e] rounded-lg">
              {editId === m.id ? (
                <>
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && renameMember(m.id)}
                    className="flex-1 bg-transparent border-b border-[#6c63ff] text-sm outline-none text-[#dde1f0]" autoFocus />
                  <button onClick={() => renameMember(m.id)} className="text-xs text-[#3ecf8e]">保存</button>
                  <button onClick={() => setEditId('')} className="text-xs text-[#444870]">取消</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-[#dde1f0]">{m.name}</span>
                  <button onClick={() => { setEditId(m.id); setEditName(m.name) }}
                    className="text-xs text-[#7e849e] hover:text-[#6c63ff]">改名</button>
                  <button onClick={() => { if (window.confirm('删除该 BD 成员？相关绑定关系也会清除。')) onDeleteMember(m.id) }}
                    className="text-xs text-[#7e849e] hover:text-[#e85d75]">删除</button>
                </>
              )}
            </div>
          ))}
          {members.length === 0 && <div className="text-xs text-[#444870] py-2">暂无成员</div>}
        </div>
      </div>
    </div>
  )
}
