'use client'
import { useEffect, useState } from 'react'
import type { Product, CreatorDaily, CreatorCommission } from '@/lib/types'
import { displayName, pct, medalEmoji, medalLabel } from '@/lib/utils'

export default function ProductCreatorPage({
  products, creatorDaily, creatorCommission,
}: {
  products: Product[]
  creatorDaily: CreatorDaily[]
  creatorCommission: CreatorCommission[]
}) {
  const [selectedPid, setSelectedPid] = useState<string>('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [search, setSearch] = useState('')
  const [commTab, setCommTab] = useState<'organic' | 'paid'>('organic')

  // Init first product + full date range
  useEffect(() => {
    if (products.length && !selectedPid) {
      const pid = products[0].id
      setSelectedPid(pid)
      const dates = creatorDaily.filter(d => d.product_id === pid).map(d => d.date).sort()
      if (dates.length) { setRangeStart(dates[0]); setRangeEnd(dates[dates.length - 1]) }
    }
  }, [products, creatorDaily, selectedPid])

  function selectProduct(pid: string) {
    setSelectedPid(pid)
    const dates = creatorDaily.filter(d => d.product_id === pid).map(d => d.date).sort()
    if (dates.length) { setRangeStart(dates[0]); setRangeEnd(dates[dates.length - 1]) }
    setSearch('')
  }

  const allDates = [...new Set(creatorDaily.filter(d => d.product_id === selectedPid).map(d => d.date))].sort()
  const minDate = allDates[0] || ''
  const maxDate = allDates[allDates.length - 1] || ''

  function quickRange(t: string) {
    const last = allDates[allDates.length - 1]; if (!last) return
    if (t === 'all') { setRangeStart(allDates[0]); setRangeEnd(last) }
    if (t === '7d')  { setRangeStart(allDates[Math.max(0, allDates.length - 7)]);  setRangeEnd(last) }
    if (t === '14d') { setRangeStart(allDates[Math.max(0, allDates.length - 14)]); setRangeEnd(last) }
    if (t === '30d') { setRangeStart(allDates[Math.max(0, allDates.length - 30)]); setRangeEnd(last) }
  }

  // Filtered creator_daily entries
  const filtered = creatorDaily.filter(d =>
    d.product_id === selectedPid && d.date >= rangeStart && d.date <= rangeEnd
  )

  // Aggregate by creator
  const creatorMap: Record<string, { orders: number; organic: number; paid: number; refund: number; channels: Set<string> }> = {}
  for (const d of filtered) {
    if (!creatorMap[d.creator]) creatorMap[d.creator] = { orders: 0, organic: 0, paid: 0, refund: 0, channels: new Set() }
    creatorMap[d.creator].orders  += d.orders
    creatorMap[d.creator].organic += d.organic_orders
    creatorMap[d.creator].paid    += d.paid_orders
    creatorMap[d.creator].refund  += d.refund_orders
    if (d.channel) creatorMap[d.creator].channels.add(d.channel)
  }

  const creatorList = Object.entries(creatorMap)
    .map(([creator, v]) => ({ creator, ...v, channels: [...v.channels].join('/') }))
    .filter(c => !search || c.creator.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.orders - a.orders)

  const totalOrders = creatorList.reduce((s, c) => s + c.orders, 0)

  // Commission distribution for selected product + date range
  const filteredComm = creatorCommission.filter(c =>
    c.product_id === selectedPid && c.date >= rangeStart && c.date <= rangeEnd && c.commission_type === commTab
  )

  // By rate: { rate -> { creators: Set, orders: number } }
  const rateMap: Record<string, { creators: Set<string>; orders: number }> = {}
  for (const c of filteredComm) {
    if (!rateMap[c.commission_rate]) rateMap[c.commission_rate] = { creators: new Set(), orders: 0 }
    rateMap[c.commission_rate].creators.add(c.creator)
    rateMap[c.commission_rate].orders += c.orders
  }
  const rateDist = Object.entries(rateMap)
    .map(([rate, v]) => ({ rate, creatorCount: v.creators.size, orders: v.orders }))
    .sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate))

  // Weighted avg commission rate
  const totalCommOrders = rateDist.reduce((s, r) => s + r.orders, 0)
  const weightedRate = totalCommOrders
    ? rateDist.reduce((s, r) => s + parseFloat(r.rate) * r.orders, 0) / totalCommOrders
    : 0

  return (
    <div className="flex" style={{ height: 'calc(100vh - 52px)' }}>
      {/* Product sidebar */}
      <div className="w-44 min-w-[176px] bg-[#13151f] border-r border-[#2a2d45] flex flex-col overflow-hidden">
        <div className="p-3 border-b border-[#2a2d45]">
          <div className="text-[10px] font-semibold text-[#444870] uppercase tracking-widest mb-1">选择产品</div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {(() => {
            const totals: Record<string, number> = {}
            for (const d of creatorDaily) totals[d.product_id] = (totals[d.product_id] || 0) + d.orders
            return [...products].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0)).map((p, i) => {
              const totalOrd = totals[p.id] || 0
              return (
              <div key={p.id} onClick={() => selectProduct(p.id)}
                className={`px-3 py-2.5 border-b border-[#2a2d45] cursor-pointer transition-all ${selectedPid === p.id ? 'bg-[rgba(108,99,255,0.15)] border-l-2 border-l-[#6c63ff] pl-2.5' : 'hover:bg-[#1c1f2e]'}`}>
                <div className="flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-5 text-sm leading-none flex-shrink-0" title={medalLabel(i)}>{medalEmoji(i)}</span>
                  <div className={`text-[13px] font-semibold leading-snug truncate ${selectedPid === p.id ? 'text-[#dde1f0]' : 'text-[#7e849e]'}`}>{displayName(p)}</div>
                </div>
                <div className="text-[11px] text-[#444870] mt-0.5 pl-6">{totalOrd.toLocaleString()} 单</div>
              </div>
            )
            })
          })()}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedPid ? (
          <div className="flex items-center justify-center h-full text-[#444870] text-sm">从左侧选择产品</div>
        ) : (
          <>
            <div className="mb-5">
              <div className="text-xl font-bold">{displayName(products.find(p => p.id === selectedPid))}</div>
              <div className="text-[11px] font-mono text-[#444870] mt-1">{selectedPid}</div>
            </div>

            {/* Time filter */}
            <div className="flex items-center gap-2 flex-wrap mb-6 p-3 bg-[#13151f] border border-[#2a2d45] rounded-xl">
              {['7d','14d','30d','all'].map(t => (
                <button key={t} onClick={() => quickRange(t)}
                  className="px-2.5 py-1 text-xs rounded-md border border-[#2a2d45] text-[#7e849e] bg-[#1c1f2e] hover:border-[#6c63ff] hover:text-white transition-all">
                  {t === 'all' ? '全部' : `近${t.replace('d','天')}`}
                </button>
              ))}
              <div className="flex items-center gap-2 text-xs text-[#444870]">
                <span>从</span>
                <input type="date" value={rangeStart} min={minDate} max={maxDate} onChange={e => setRangeStart(e.target.value)}
                  className="bg-[#1c1f2e] border border-[#2a2d45] rounded-md px-2 py-1 text-xs text-[#dde1f0] outline-none focus:border-[#6c63ff]" style={{colorScheme:'dark'}} />
                <span>至</span>
                <input type="date" value={rangeEnd} min={minDate} max={maxDate} onChange={e => setRangeEnd(e.target.value)}
                  className="bg-[#1c1f2e] border border-[#2a2d45] rounded-md px-2 py-1 text-xs text-[#dde1f0] outline-none focus:border-[#6c63ff]" style={{colorScheme:'dark'}} />
              </div>
              <div className="ml-auto text-[11px] text-[#444870]">{allDates.filter(d => d >= rangeStart && d <= rangeEnd).length} 天</div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Creator ranking */}
              <div className="bg-[#13151f] border border-[#2a2d45] rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-[#1c1f2e] flex items-center gap-3">
                  <span className="text-[11px] font-semibold text-[#444870] uppercase tracking-wider">达人排行</span>
                  <input placeholder="搜索达人..." value={search} onChange={e => setSearch(e.target.value)}
                    className="ml-auto bg-[#13151f] border border-[#2a2d45] rounded-md px-2 py-1 text-xs text-[#dde1f0] outline-none focus:border-[#6c63ff] w-36 placeholder-[#444870]" />
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1c1f2e] border-t border-[#2a2d45]">
                      {['#','达人','渠道','总单','自然流','广告流','退货','退货率','占比'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[11px] text-[#444870] font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {creatorList.length === 0 ? (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-xs text-[#444870]">暂无数据</td></tr>
                    ) : creatorList.map((c, i) => (
                      <tr key={c.creator} className="border-t border-[#2a2d45] hover:bg-[rgba(255,255,255,0.02)]">
                        <td className="px-3 py-2.5 text-sm" title={medalLabel(i)}>{medalEmoji(i)}</td>
                        <td className="px-3 py-2.5">
                          <div className="text-[13px] font-semibold text-[#dde1f0] max-w-[120px] truncate">{c.creator || '—'}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${c.channels.includes('视频') && c.channels.includes('直播') ? 'bg-[rgba(108,99,255,0.15)] text-[#a78bfa]' : c.channels.includes('直播') ? 'bg-[rgba(248,113,113,0.15)] text-[#f87171]' : 'bg-[rgba(56,189,248,0.15)] text-[#38bdf8]'}`}>
                            {c.channels || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold">{c.orders}</td>
                        <td className="px-3 py-2.5 tabular-nums text-[#3ecf8e]">{c.organic} <span className="text-[11px] text-[#444870]">{pct(c.organic, c.orders)}%</span></td>
                        <td className="px-3 py-2.5 tabular-nums text-[#f5a623]">{c.paid} <span className="text-[11px] text-[#444870]">{pct(c.paid, c.orders)}%</span></td>
                        <td className="px-3 py-2.5 tabular-nums text-[#e85d75]">{c.refund}</td>
                        <td className="px-3 py-2.5 tabular-nums text-[11px] text-[#e85d75]">{pct(c.refund, c.orders)}%</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 bg-[#2a2d45] rounded-full overflow-hidden">
                              <div className="h-full bg-[#6c63ff] rounded-full" style={{ width: `${pct(c.orders, totalOrders)}%` }} />
                            </div>
                            <span className="text-[11px] text-[#444870]">{pct(c.orders, totalOrders)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {creatorList.length > 0 && (
                  <div className="px-4 py-2.5 border-t border-[#2a2d45] bg-[#1c1f2e] text-xs text-[#444870]">
                    共 {creatorList.length} 个达人 · 合计 {totalOrders.toLocaleString()} 单
                  </div>
                )}
              </div>

              {/* Commission distribution */}
              <div className="bg-[#13151f] border border-[#2a2d45] rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-[#1c1f2e] flex items-center gap-3">
                  <span className="text-[11px] font-semibold text-[#444870] uppercase tracking-wider">佣金率分布</span>
                  <div className="ml-auto flex rounded-lg overflow-hidden border border-[#2a2d45]">
                    {(['organic','paid'] as const).map(t => (
                      <button key={t} onClick={() => setCommTab(t)}
                        className={`px-3 py-1 text-xs font-medium transition-all ${commTab === t ? 'bg-[#6c63ff] text-white' : 'text-[#7e849e] bg-[#13151f] hover:text-white'}`}>
                        {t === 'organic' ? '自然流' : '广告流'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Weighted rate KPI */}
                <div className="px-4 py-4 border-b border-[#2a2d45] flex items-center gap-6">
                  <div>
                    <div className="text-[11px] text-[#444870] mb-1">加权平均{commTab === 'organic' ? '自然流' : '广告'}佣金率</div>
                    <div className="text-2xl font-bold text-[#6c63ff]">{weightedRate.toFixed(2)}%</div>
                  </div>
                  <div className="text-xs text-[#444870] leading-relaxed">
                    基于 {totalCommOrders.toLocaleString()} 笔成交<br />加权计算
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1c1f2e] border-t border-[#2a2d45]">
                      {['佣金率','达人数','订单数','订单占比','佣金占比条'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-[11px] text-[#444870] font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rateDist.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-[#444870]">暂无数据</td></tr>
                    ) : rateDist.map(r => (
                      <tr key={r.rate} className="border-t border-[#2a2d45] hover:bg-[rgba(255,255,255,0.02)]">
                        <td className="px-4 py-3">
                          <span className="bg-[rgba(108,99,255,0.15)] text-[#6c63ff] px-2 py-0.5 rounded text-[12px] font-bold">{r.rate}</span>
                        </td>
                        <td className="px-4 py-3 tabular-nums font-semibold">{r.creatorCount}</td>
                        <td className="px-4 py-3 tabular-nums">{r.orders.toLocaleString()}</td>
                        <td className="px-4 py-3 tabular-nums text-xs text-[#7e849e]">{pct(r.orders, totalCommOrders)}%</td>
                        <td className="px-4 py-3 w-32">
                          <div className="h-1.5 bg-[#2a2d45] rounded-full overflow-hidden">
                            <div className="h-full bg-[#6c63ff] rounded-full" style={{ width: `${pct(r.orders, totalCommOrders)}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
