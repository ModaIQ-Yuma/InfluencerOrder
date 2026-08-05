'use client'
import { useEffect, useState, useRef } from 'react'
import { useAuth } from './AuthContext'
import type { Product } from '@/lib/types'

export default function ProductsPage({ onDataRefresh }: { onDataRefresh?: () => Promise<void> }) {
  const { password, authed, setAuthed, setPassword } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const [toast, setToast] = useState('')
  const [pwInput, setPwInput] = useState('')
  const [clearing, setClearing] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showRename, setShowRename] = useState(false)
  const [renameOld, setRenameOld] = useState('')
  const [renameNew, setRenameNew] = useState('')
  const [renaming, setRenaming] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { fetchProducts() }, [])

  async function fetchProducts() {
    const res = await fetch('/api/data')
    const d = await res.json()
    setProducts(d.products || [])
  }

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }

  async function verifyPassword() {
    const fd = new FormData()
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'x-upload-password': pwInput },
      body: fd,
    })
    if (res.status === 401) showToast('密码错误')
    else { setAuthed(true); setPassword(pwInput); showToast('已验证') }
  }

  async function saveName(id: string) {
    if (!authed) return
    setSaving(s => ({ ...s, [id]: true }))
    await fetch('/api/product', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-upload-password': password },
      body: JSON.stringify({ id, internal_name: editing[id] ?? '' }),
    })
    setSaving(s => ({ ...s, [id]: false }))
    setEditing(e => { const n = { ...e }; delete n[id]; return n })
    fetchProducts(); showToast('已保存')
  }

  async function deleteProduct(id: string) {
    if (!authed) return
    const res = await fetch('/api/product', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', 'x-upload-password': password },
      body: JSON.stringify({ id }),
    })
    if (res.ok) { fetchProducts(); onDataRefresh?.(); showToast('商品已删除') }
    else { const d = await res.json(); showToast(d.error || '删除失败') }
  }

  async function addProduct() {
    if (!newId.trim()) { showToast('请输入商品 ID'); return }
    await fetch('/api/product', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-upload-password': password },
      body: JSON.stringify({ id: newId.trim(), internal_name: newName.trim() }),
    })
    setNewId(''); setNewName(''); setShowAdd(false)
    fetchProducts(); showToast('已添加')
  }

  async function clearData() {
    setClearing(true)
    await fetch('/api/clear', { method: 'POST', headers: { 'x-upload-password': password } })
    setClearing(false); setShowClearConfirm(false)
    onDataRefresh?.(); showToast('订单数据已清除')
  }

  async function renameCreator() {
    if (!renameOld.trim() || !renameNew.trim()) { showToast('原名和现名不能为空'); return }
    setRenaming(true)
    const res = await fetch('/api/creator-rename', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-upload-password': password },
      body: JSON.stringify({ oldName: renameOld.trim(), newName: renameNew.trim() }),
    })
    const d = await res.json()
    setRenaming(false)
    if (d.ok) { showToast('达人名称已更新'); setShowRename(false); setRenameOld(''); setRenameNew('') }
    else showToast(d.error || '更改失败')
  }

  const sorted = [...products].sort((a, b) => (a.internal_name || '\uffff').localeCompare(b.internal_name || '\uffff'))

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight mb-1">🗂️ 商品档案</h1>
          <p className="text-sm text-[#7e849e]">内部名称在所有分析页面中显示，替代商品 ID。</p>
        </div>
        {authed && (
          <div className="flex gap-2">
            <button onClick={() => { setShowRename(true); setShowClearConfirm(false) }}
              className="px-3 py-2 text-xs rounded-lg border border-[#2a2d45] text-[#7e849e] hover:border-[#6c63ff] hover:text-[#6c63ff] transition-all">
              达人 ID 变更
            </button>
            <button onClick={() => { setShowClearConfirm(true); setShowRename(false) }}
              className="px-3 py-2 text-xs rounded-lg border border-[#2a2d45] text-[#7e849e] hover:border-red-500 hover:text-red-400 transition-all">
              清除订单数据
            </button>
          </div>
        )}
      </div>

      {/* 密码验证 */}
      {!authed && (
        <div className="mb-6 p-4 rounded-xl bg-[#13151f] border border-[#2a2d45]">
          <div className="text-xs text-[#7e849e] mb-3">输入上传密码以编辑商品名称、达人改名、清除数据</div>
          <div className="flex gap-2">
            <input type="password" placeholder="上传密码" value={pwInput}
              onChange={e => setPwInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verifyPassword()}
              className="flex-1 bg-[#1c1f2e] border border-[#2a2d45] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6c63ff]"
              style={{ color: '#dde1f0' }} />
            <button onClick={verifyPassword}
              className="px-4 py-2 bg-[#6c63ff] text-white text-sm rounded-lg hover:opacity-85 transition-all">
              验证
            </button>
          </div>
        </div>
      )}

      {/* 达人改名 */}
      {showRename && authed && (
        <div className="mb-6 p-4 rounded-xl bg-[#13151f] border border-[#6c63ff]/40">
          <div className="text-sm font-semibold text-[#dde1f0] mb-1">达人 ID 变更</div>
          <div className="text-xs text-[#7e849e] mb-4">将数据库中所有该达人的原名替换为现名，操作不可撤销。</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-[11px] text-[#444870] uppercase tracking-wider mb-1.5">原名</div>
              <input value={renameOld} onChange={e => setRenameOld(e.target.value)}
                placeholder="输入达人原用户名"
                className="w-full bg-[#1c1f2e] border border-[#2a2d45] rounded-lg px-3 py-2 text-sm text-[#dde1f0] outline-none focus:border-[#6c63ff] placeholder-[#444870]" />
            </div>
            <div>
              <div className="text-[11px] text-[#444870] uppercase tracking-wider mb-1.5">现名</div>
              <input value={renameNew} onChange={e => setRenameNew(e.target.value)}
                placeholder="输入达人现用户名"
                onKeyDown={e => e.key === 'Enter' && renameCreator()}
                className="w-full bg-[#1c1f2e] border border-[#2a2d45] rounded-lg px-3 py-2 text-sm text-[#dde1f0] outline-none focus:border-[#6c63ff] placeholder-[#444870]" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowRename(false); setRenameOld(''); setRenameNew('') }}
              className="px-3 py-1.5 text-xs rounded-lg border border-[#2a2d45] text-[#7e849e]">取消</button>
            <button onClick={renameCreator} disabled={renaming}
              className="px-4 py-1.5 text-xs rounded-lg bg-[#6c63ff] text-white disabled:opacity-50">
              {renaming ? '更改中...' : '更改合并'}
            </button>
          </div>
        </div>
      )}

      {/* 清除确认 */}
      {showClearConfirm && authed && (
        <div className="mb-6 p-4 rounded-xl bg-[#13151f] border border-red-500/40">
          <div className="text-sm text-[#dde1f0] mb-3">确认清除所有订单数据？商品档案和内部名称会保留。</div>
          <div className="flex gap-2">
            <button onClick={clearData} disabled={clearing}
              className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:opacity-85 disabled:opacity-50">
              {clearing ? '清除中...' : '确认清除'}
            </button>
            <button onClick={() => setShowClearConfirm(false)}
              className="px-4 py-2 bg-[#1c1f2e] text-[#7e849e] text-sm rounded-lg border border-[#2a2d45]">
              取消
            </button>
          </div>
        </div>
      )}

      {/* 商品列表 */}
      <div className="flex flex-col gap-1.5 mb-2">
        {sorted.map(p => {
          const isEditing = p.id in editing
          const val = editing[p.id] ?? p.internal_name
          return (
            <div key={p.id} className={`flex items-center gap-4 px-4 py-3 rounded-xl bg-[#13151f] border transition-all ${isEditing ? 'border-[#6c63ff]' : 'border-[#2a2d45] hover:border-[#363a58]'}`}>
              <input
                className="w-32 bg-transparent border-b border-dashed border-[#2a2d45] focus:border-[#6c63ff] text-sm font-semibold outline-none py-0.5 text-[#dde1f0] transition-all"
                value={val} placeholder={authed ? '设置名称...' : '—'} disabled={!authed}
                onChange={e => setEditing(ed => ({ ...ed, [p.id]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && saveName(p.id)} />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[#7e849e] truncate">{p.full_name || '暂无商品名称'}</div>
                <div className="text-[10px] text-[#444870] font-mono mt-0.5">{p.id}</div>
              </div>
              {authed && isEditing && (
                <button onClick={() => saveName(p.id)} disabled={saving[p.id]}
                  className="px-3 py-1 bg-[#6c63ff] text-white text-xs rounded-md hover:opacity-85 disabled:opacity-50 whitespace-nowrap">
                  {saving[p.id] ? '...' : '保存'}
                </button>
              )}
              {authed && !isEditing && (
                <button onClick={() => { if (window.confirm('确认删除该商品及其所有订单数据？')) deleteProduct(p.id) }}
                  className="px-2 py-1 text-xs rounded-md border border-[#2a2d45] text-[#444870] hover:border-red-500 hover:text-red-400 transition-all whitespace-nowrap">
                  删除
                </button>
              )}
            </div>
          )
        })}
        {sorted.length === 0 && (
          <div className="text-center py-12 text-[#444870] text-sm">暂无商品，上传订单后自动添加</div>
        )}
      </div>

      {/* 手动添加 */}
      {authed && (
        showAdd ? (
          <div className="p-4 rounded-xl bg-[#13151f] border border-[#6c63ff] flex flex-col gap-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-[#444870] uppercase tracking-wider mb-1.5">内部名称</div>
                <input className="w-full bg-[#1c1f2e] border border-[#2a2d45] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6c63ff]"
                  value={newName} onChange={e => setNewName(e.target.value)} placeholder="内部名称" style={{ color: '#dde1f0' }} />
              </div>
              <div>
                <div className="text-[11px] text-[#444870] uppercase tracking-wider mb-1.5">商品 ID</div>
                <input className="w-full bg-[#1c1f2e] border border-[#2a2d45] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6c63ff]"
                  value={newId} onChange={e => setNewId(e.target.value)} placeholder="18位数字" style={{ color: '#dde1f0' }} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs rounded-lg border border-[#2a2d45] text-[#7e849e]">取消</button>
              <button onClick={addProduct} className="px-3 py-1.5 text-xs rounded-lg bg-[#6c63ff] text-white">添加</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)}
            className="mt-2 w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[#363a58] text-[#444870] text-sm hover:border-[#6c63ff] hover:text-[#6c63ff] transition-all">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            手动添加商品
          </button>
        )
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-lg bg-[#242840] border border-[#363a58] text-sm shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
