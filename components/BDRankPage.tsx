'use client'
import { useState, useMemo } from 'react'
import type { Product, CreatorDaily, BDMember, BDAssignment, BDMode } from '@/lib/types'
import { displayName, medalEmoji, medalLabel } from '@/lib/utils'

export default function BDRankPage({
  products, creatorDaily, bdMembers, bdAssignments, bdMode,
}: {
  products: Product[]
  creatorDaily: CreatorDaily[]
  bdMembers: BDMember[]
  bdAssignments: BDAssignment[]
  bdMode: BDMode | null
}) {
  const [selectedPids, setSelectedPids] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')

  const allDates = useMemo(() => [...new Set(creatorDaily.map(d => d.date))].sort(), [creatorDaily])
  const minDate = allDates[0] || ''
  const maxDate = allDates[allDates.length - 1] || ''

  function quickRange(t: string) {
    const last = allDates[allDates.length - 1]; if (!last) return
    if (t === 'all') { setRangeStart(''); setRangeEnd('') }
    if (t === '7d')  { setRangeStart(allDates[Math.max(0, allDates.length - 7)]);  setRangeEnd(last) }
    if (t === '14d') { setRangeStart(allDates[Math.max(0, allDates.length - 14)]); setRangeEnd(last) }
    if (t === '30d') { setRangeStart(allDates[Math.max(0, allDates.length - 30)]); setRangeEnd(last) }
  }

  function togglePid(pid: string) {
    setSelectedPids(prev => { const next = new Set(prev); next.has(pid) ? next.delete(pid) : next.add(pid); return next })
  }

  function getBdId(creator: string, product_id: string): string | null {
    if (!bdMode) return null
    if (bdMode === 'creator') {
      return bdAssignments.find(a => a.creator === creator && a.product_id === null)?.bd_id || null
    }
    if (bdMode === 'product') {
      return bdAssignments.find(a => a.product_id === product_id && a.creator === '')?.bd_id || null
    }
    const exact = bdAssignments.find(a => a.creator === creator && a.product_id === product_id)
    if (exact) return exact.bd_id
    return bdAssignments.find(a => a.creator === creator && a.product_id === null)?.bd_id || null
  }

  const filtered = useMemo(() => {
    return creatorDaily.filter(d => {
      if (selectedPids.size > 0 && !selectedPids.has(d.product_id)) return false
      if (rangeStart && d.date < rangeStart) return false
      if (rangeEnd && d.date > rangeEnd) return false
      return true
    })
  }, [creatorDaily, selectedPids, rangeStart, rangeEnd])

  const bdStats = useMemo(() => {
    const map: Record<string, { orders: number; creators: Record<string, number> }> = {}
    for (const m of bdMembers) map[m.id] = { orders: 0, creators: {} }

    for (const d of filtered) {
      const bdId = getBdId(d.creator, d.product_id)
      if (!bdId || !map[bdId]) continue
      map[bdId].orders += d.orders
      map[bdId].creators[d.creator] = (map[bdId].creators[d.creator] || 0) + d.orders
    }

    return bdMembers.map(m => ({
      ...m,
      orders: map[m.id]?.orders || 0,
      creators: Object.entries(map[m.id]?.creators || {})
        .map(([creator, orders]) => ({ creator, orders }))
        .sort((a, b) => b.orders - a.orders),
    })).sort((a, b) => b.orders - a.orders)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, bdMembers, bdAssignments, bdMode])

  const totalOrders = bdStats.reduce((s, b) => s + b.orders, 0)

  if (!bdMode) {
    return <div className="flex items-center justify-center h-full text-[#444870] text-sm">请先在右上角菜单中设置 BD 分配模式</div>
  }
  if (bdMembers.length === 0) {
    return <div className="flex items-center justify-center h-full text-[#444870] text-sm">请先在右上角菜单中添加 BD 成员</div>
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight mb-1">BD 排行榜</h1>
        <p className="text-sm text-[#7e849e]">按负责 BD 汇总订单量</p>
      </div>

      {/* 筛选区 */}
      <div className="bg-[#13151f] border border-[#2a2d45] rounded-xl p-4 mb-4">
        {/* 时间筛选 */}
        <div className="text-[11px] text-[#444870] uppercase tracking-wider mb-3">时间范围</div>
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {['7d','14d','30d','all'].map(t => (
            <button key={t} onClick={() => quickRange(t)}
              className="px-2.5 py-1 text-xs rounded-md border border-[#2a2d45] text-[#7e849e] bg-[#1c1f2e] hover:border-[#6c63ff] hover:text-white transition-all">
              {t === 'all' ? '全部' : `近${t.replace('d','天')}`}
            </button>
          ))}
          <div className="flex items-center gap-2 text-xs text-[#444870]">
            <span>从</span>
            <input type="date" value={rangeStart} min={minDate} max={maxDate}
              onChange={e => setRangeStart(e.target.value)}
              className="bg-[#1c1f2e] border border-[#2a2d45] rounded-md px-2 py-1 text-xs text-[#dde1f0] outline-none focus:border-[#6c63ff]"
              style={{ colorScheme: 'dark' }} />
            <span>至</span>
            <input type="date" value={rangeEnd} min={minDate} max={maxDate}
              onChange={e => setRangeEnd(e.target.value)}
              className="bg-[#1c1f2e] border border-[#2a2d45] rounded-md px-2 py-1 text-xs text-[#dde1f0] outline-none focus:border-[#6c63ff]"
              style={{ colorScheme: 'dark' }} />
          </div>
        </div>

        {/* 产品多选 */}
        <div className="text-[11px] text-[#444870] uppercase tracking-wider mb-3">筛选产品（不选 = 全部）</div>
        <div className="flex flex-wrap gap-2">
          {products.map(p => (
            <button key={p.id} onClick={() => togglePid(p.id)}
              className={`px-3 py-1 text-xs rounded-lg border transition-all ${selectedPids.has(p.id) ? 'bg-[#6c63ff] border-[#6c63ff] text-white' : 'border-[#2a2d45] text-[#7e849e] hover:border-[#6c63ff] hover:text-white'}`}>
              {displayName(p)}
            </button>
          ))}
        </div>
      </div>

      {/* 总计 */}
      <div className="bg-[#13151f] border border-[#2a2d45] rounded-xl p-4 mb-4 flex items-center justify-between">
        <div className="text-sm text-[#7e849e]">已归属订单总量</div>
        <div className="text-2xl font-bold text-[#6c63ff]">{totalOrders.toLocaleString()}</div>
      </div>

      {/* BD 排行 */}
      <div className="flex flex-col gap-3">
        {bdStats.map((bd, i) => {
          const isExpanded = expanded.has(bd.id)
          const ratio = totalOrders ? Math.round(bd.orders / totalOrders * 100) : 0
          return (
            <div key={bd.id} className="bg-[#13151f] border border-[#2a2d45] rounded-xl overflow-hidden">
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[#1c1f2e] transition-all"
                onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(bd.id) ? n.delete(bd.id) : n.add(bd.id); return n })}>
                <span className="text-xl w-8 text-center flex-shrink-0" title={medalLabel(i)}>{medalEmoji(i)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-[#dde1f0]">{bd.name}</span>
                    <span className="text-xs text-[#444870]">{bd.creators.length} 个达人</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-[#2a2d45] rounded-full overflow-hidden">
                    <div className="h-full bg-[#6c63ff] rounded-full transition-all" style={{ width: `${ratio}%` }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xl font-bold tabular-nums">{bd.orders.toLocaleString()}</div>
                  <div className="text-xs text-[#444870]">{ratio}%</div>
                </div>
                <svg className={`w-4 h-4 text-[#444870] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {isExpanded && bd.creators.length > 0 && (
                <div className="border-t border-[#2a2d45]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#1c1f2e]">
                        {['达人', '订单数', '占BD总量'].map(h => (
                          <th key={h} className="px-4 py-2 text-left text-[11px] text-[#444870] font-semibold uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bd.creators.map((c, ci) => (
                        <tr key={c.creator} className={`border-t border-[#2a2d45] ${ci % 2 === 0 ? '' : 'bg-[rgba(255,255,255,0.01)]'}`}>
                          <td className="px-4 py-2.5 text-[13px] text-[#dde1f0]">{c.creator}</td>
                          <td className="px-4 py-2.5 tabular-nums font-semibold">{c.orders.toLocaleString()}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 bg-[#2a2d45] rounded-full overflow-hidden">
                                <div className="h-full bg-[#3ecf8e] rounded-full" style={{ width: `${bd.orders ? Math.round(c.orders / bd.orders * 100) : 0}%` }} />
                              </div>
                              <span className="text-xs text-[#444870]">{bd.orders ? Math.round(c.orders / bd.orders * 100) : 0}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {isExpanded && bd.creators.length === 0 && (
                <div className="border-t border-[#2a2d45] px-5 py-3 text-xs text-[#444870]">暂无归属达人的订单数据</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
