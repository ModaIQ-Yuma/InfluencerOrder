'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from './AuthContext'
import type { Product, DailyEntry, PriceDetail } from '@/lib/types'
import { displayName, pct, medalEmoji, medalLabel } from '@/lib/utils'

export default function AnalysisPage({ products, daily, onDataRefresh }: {
  products: Product[]
  daily: DailyEntry[]
  onDataRefresh: () => Promise<void>
}) {
  const { password, authed, setAuthed, setPassword } = useAuth()
  const [currentPid, setCurrentPid] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [toast, setToast] = useState('')
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')
  const [priceExpanded, setPriceExpanded] = useState(true)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; entry: DailyEntry | null; date: string } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [showPwModal, setShowPwModal] = useState(false)
  const [modalPw, setModalPw] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }

  function getTotalOrders(pid: string) {
    return daily.filter(d => d.product_id === pid).reduce((s, d) => s + d.total_orders, 0)
  }

  const sortedProducts = [...products]
    .filter(p => !search || displayName(p).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => getTotalOrders(b.id) - getTotalOrders(a.id))

  const currentProduct = products.find(p => p.id === currentPid)
  const productDaily = daily.filter(d => d.product_id === currentPid).sort((a, b) => a.date.localeCompare(b.date))
  const productMonths = [...new Set(productDaily.map(d => d.date.substring(0, 7)))].sort()
  const productDates = productDaily.map(d => d.date)
  const minDate = productDates[0] || ''
  const maxDate = productDates[productDates.length - 1] || ''

  function selectProduct(pid: string) {
    setCurrentPid(pid)
    const dates = daily.filter(d => d.product_id === pid).map(d => d.date).sort()
    setFilterStart(dates[0] || '')
    setFilterEnd(dates[dates.length - 1] || '')
  }

  const filteredDaily = productDaily.filter(d => d.date >= filterStart && d.date <= filterEnd)

  function getAggregate() {
    const priceMap: Record<string, PriceDetail> = {}
    let totalOrders = 0, totalUnits = 0, totalOrganic = 0, totalPaid = 0, totalRefund = 0
    for (const e of filteredDaily) {
      totalOrders += e.total_orders; totalUnits += e.total_units
      totalOrganic += e.organic_orders; totalPaid += e.paid_orders
      totalRefund += e.refund_orders ?? 0
      for (const [price, pd] of Object.entries(e.prices)) {
        if (!priceMap[price]) priceMap[price] = { orders: 0, units: 0, organic: 0, paid: 0, refund: 0 }
        priceMap[price].orders += pd.orders; priceMap[price].units += pd.units
        priceMap[price].organic += pd.organic; priceMap[price].paid += pd.paid
        priceMap[price].refund += pd.refund ?? 0
      }
    }
    return { totalOrders, totalUnits, totalOrganic, totalPaid, totalRefund, prices: priceMap }
  }

  function setRange(type: string) {
    const dates = productDates
    const last = dates[dates.length - 1]
    if (type === 'all') { setFilterStart(dates[0]); setFilterEnd(last) }
    else if (type === '7d')  { setFilterStart(dates[Math.max(0, dates.length - 7)]);  setFilterEnd(last) }
    else if (type === '14d') { setFilterStart(dates[Math.max(0, dates.length - 14)]); setFilterEnd(last) }
    else if (type === '30d') { setFilterStart(dates[Math.max(0, dates.length - 30)]); setFilterEnd(last) }
    else {
      const [yr, mo] = type.split('-')
      setFilterStart(`${yr}-${mo}-01`)
      setFilterEnd(`${yr}-${mo}-${new Date(+yr, +mo, 0).getDate()}`)
    }
  }

  function handleFile(file: File) {
    if (!authed) { setPendingFile(file); setShowPwModal(true) }
    else doUpload(file, password)
  }

  async function confirmUpload() {
    if (!modalPw || !pendingFile) return
    setShowPwModal(false); setAuthed(true); setPassword(modalPw)
    await doUpload(pendingFile, modalPw)
    setModalPw(''); setPendingFile(null)
  }

  async function doUpload(file: File, pw: string) {
    setUploading(true); setUploadMsg('')
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', headers: { 'x-upload-password': pw }, body: fd })
    const d = await res.json()
    setUploading(false)
    if (d.ok) { setUploadMsg(`✓ 已导入 ${d.imported} 条`); onDataRefresh(); showToast('上传成功') }
    else if (res.status === 401) showToast('密码错误')
    else showToast(d.error || '上传失败')
  }

  const filteredDates = filteredDaily.map(d => d.date)
  const filteredEntries = filteredDates.map(date => productDaily.find(d => d.date === date) || null)

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement!
    const dpr = window.devicePixelRatio || 1
    const W = parent.clientWidth - 40, H = 220
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
    canvas.width = W * dpr; canvas.height = H * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H)

    const dates = filteredDates, entries = filteredEntries
    if (!dates.length) {
      ctx.fillStyle = '#444870'; ctx.font = '13px -apple-system,sans-serif'
      ctx.textAlign = 'center'; ctx.fillText('该时间段内无数据', W / 2, H / 2); return
    }

    const values  = entries.map(e => e?.total_orders || 0)
    const organic = entries.map(e => e?.organic_orders || 0)
    const refunds = entries.map(e => e?.refund_orders || 0)
    const maxVal  = Math.max(...values, 1)
    const padL = 52, padR = 16, padT = 20, padB = 36
    const chartW = W - padL - padR, chartH = H - padT - padB

    ctx.strokeStyle = '#2a2d45'; ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = padT + (chartH / 4) * i
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke()
      ctx.fillStyle = '#444870'; ctx.font = '10px -apple-system,sans-serif'; ctx.textAlign = 'right'
      ctx.fillText(String(Math.round(maxVal * (1 - i / 4))), padL - 6, y + 4)
    }
    const step = Math.max(1, Math.floor(dates.length / 8))
    ctx.fillStyle = '#444870'; ctx.font = '10px -apple-system,sans-serif'; ctx.textAlign = 'center'
    dates.forEach((d, i) => { if (i % step === 0 || i === dates.length - 1) ctx.fillText(d.substring(5), padL + (i / (dates.length - 1 || 1)) * chartW, H - padB + 16) })

    const xPos = (i: number) => padL + (i / (dates.length - 1 || 1)) * chartW
    const yPos = (v: number) => padT + chartH - (v / maxVal) * chartH

    const drawArea = (vals: number[], c1: string, c2: string) => {
      ctx.beginPath()
      vals.forEach((v, i) => i === 0 ? ctx.moveTo(xPos(i), yPos(v)) : ctx.lineTo(xPos(i), yPos(v)))
      ctx.lineTo(xPos(vals.length - 1), padT + chartH); ctx.lineTo(xPos(0), padT + chartH); ctx.closePath()
      const g = ctx.createLinearGradient(0, padT, 0, padT + chartH)
      g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fill()
    }
    drawArea(values,  'rgba(108,99,255,0.20)', 'rgba(108,99,255,0)')
    drawArea(organic, 'rgba(62,207,142,0.12)', 'rgba(62,207,142,0)')

    const drawLine = (vals: number[], color: string, width: number, dash: number[] = []) => {
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'
      ctx.setLineDash(dash)
      vals.forEach((v, i) => i === 0 ? ctx.moveTo(xPos(i), yPos(v)) : ctx.lineTo(xPos(i), yPos(v)))
      ctx.stroke(); ctx.setLineDash([])
    }
    drawLine(values, '#6c63ff', 2)
    drawLine(organic, '#3ecf8e', 1.5)
    drawLine(refunds, '#e85d75', 1.5, [4, 3])

    ctx.font = '11px -apple-system,sans-serif'; ctx.textAlign = 'left'
    ctx.fillStyle = '#6c63ff'; ctx.fillRect(padL, 6, 14, 2.5)
    ctx.fillStyle = '#7e849e'; ctx.fillText('总订单', padL + 18, 11)
    ctx.fillStyle = '#3ecf8e'; ctx.fillRect(padL + 68, 6, 14, 2.5)
    ctx.fillStyle = '#7e849e'; ctx.fillText('自然流', padL + 86, 11)
    ctx.fillStyle = '#e85d75'; ctx.fillRect(padL + 136, 6, 14, 2.5)
    ctx.fillStyle = '#7e849e'; ctx.fillText('退货', padL + 154, 11)

    canvas.dataset.padL = String(padL); canvas.dataset.padR = String(padR)
    canvas.dataset.chartW = String(chartW); canvas.dataset.W = String(W); canvas.dataset.len = String(dates.length)
  }, [filteredDates, filteredEntries])

  useEffect(() => { if (currentPid) drawChart() }, [currentPid, filterStart, filterEnd, drawChart])
  useEffect(() => { window.addEventListener('resize', drawChart); return () => window.removeEventListener('resize', drawChart) }, [drawChart])

  function handleCanvasMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const padL = parseFloat(canvas.dataset.padL || '52'), padR = parseFloat(canvas.dataset.padR || '16')
    const chartW = parseFloat(canvas.dataset.chartW || '0'), W = parseFloat(canvas.dataset.W || '0')
    const len = parseInt(canvas.dataset.len || '0')
    if (mx < padL || mx > W - padR || len === 0) { setTooltip(null); return }
    const idx = Math.min(len - 1, Math.max(0, Math.round((mx - padL) / chartW * (len - 1))))
    setTooltip({ x: e.clientX, y: e.clientY, entry: filteredEntries[idx] || null, date: filteredDates[idx] })
  }

  const agg = currentPid ? getAggregate() : null
  const priceCount = agg ? Object.keys(agg.prices).length : 0

  return (
    <div className="flex" style={{ height: 'calc(100vh - 52px)' }}>

      {/* 密码弹窗 */}
      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1c1f2e] border border-[#2a2d45] rounded-xl p-6 w-80 shadow-2xl">
            <div className="text-sm font-semibold text-[#dde1f0] mb-1">输入上传密码</div>
            <div className="text-xs text-[#7e849e] mb-4">验证后即可上传订单文件</div>
            <input type="password" placeholder="密码" value={modalPw} autoFocus
              onChange={e => setModalPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmUpload()}
              className="w-full bg-[#13151f] border border-[#2a2d45] rounded-lg px-3 py-2 text-sm text-[#dde1f0] outline-none focus:border-[#6c63ff] mb-3" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowPwModal(false); setModalPw(''); setPendingFile(null) }}
                className="px-3 py-1.5 text-xs rounded-lg border border-[#2a2d45] text-[#7e849e]">取消</button>
              <button onClick={confirmUpload} className="px-4 py-1.5 text-xs rounded-lg bg-[#6c63ff] text-white">确认上传</button>
            </div>
          </div>
        </div>
      )}

      {/* 侧边栏 */}
      <div className="w-48 min-w-[192px] bg-[#13151f] border-r border-[#2a2d45] flex flex-col overflow-hidden">
        <div className="p-3 border-b border-[#2a2d45]">
          <div className="text-[10px] font-semibold text-[#444870] uppercase tracking-widest mb-2">商品</div>
          <input className="w-full bg-[#1c1f2e] border border-[#2a2d45] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#6c63ff] text-[#dde1f0] placeholder-[#444870]"
            placeholder="搜索..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {/* 上传区 */}
        <label className={`mx-3 mt-3 mb-1 flex flex-col items-center justify-center p-3 rounded-lg border border-dashed border-[#363a58] cursor-pointer text-center transition-all ${uploading ? 'opacity-50' : 'hover:border-[#6c63ff]'}`}>
          <input type="file" accept=".xlsx,.xls" className="hidden" disabled={uploading}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <span className="text-base mb-1">⬆️</span>
          <span className="text-[11px] text-[#7e849e] leading-tight">
            {uploading ? '上传中...' : <><b className="text-[#dde1f0]">上传订单</b><br />.xlsx</>}
          </span>
        </label>
        {uploadMsg && <div className="mx-3 text-[10px] text-[#3ecf8e] leading-snug mb-1">{uploadMsg}</div>}
        <div className="flex-1 overflow-y-auto">
          {sortedProducts.map((p, i) => (
            <div key={p.id} onClick={() => selectProduct(p.id)}
              className={`px-3 py-2.5 border-b border-[#2a2d45] cursor-pointer transition-all ${currentPid === p.id ? 'bg-[rgba(108,99,255,0.15)] border-l-2 border-l-[#6c63ff] pl-2.5' : 'hover:bg-[#1c1f2e]'}`}>
              <div className="flex items-center gap-1.5">
                <span className="flex items-center justify-center w-5 text-sm leading-none flex-shrink-0" title={medalLabel(i)}>{medalEmoji(i)}</span>
                <div className="text-[13px] font-semibold text-[#dde1f0] leading-snug truncate">{displayName(p)}</div>
              </div>
              <div className="text-[11px] text-[#444870] mt-0.5 pl-6">{getTotalOrders(p.id).toLocaleString()} 单</div>
            </div>
          ))}
        </div>
      </div>

      {/* 主内容 */}
      <div className="flex-1 overflow-y-auto p-6">
        {!currentPid ? (
          <div className="flex flex-col items-center justify-center h-full text-[#444870] gap-3">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity={0.3}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h4"/></svg>
            <span className="text-sm">从左侧选择商品</span>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <div className="text-[22px] font-bold tracking-tight">{displayName(currentProduct)}</div>
              <div className="text-[11px] font-mono text-[#444870] mt-1">{currentPid}</div>
            </div>

            {/* 时间筛选 */}
            <div className="flex items-center gap-2 flex-wrap mb-6 p-3 bg-[#13151f] border border-[#2a2d45] rounded-xl">
              {['7d','14d','30d'].map(t => (
                <button key={t} onClick={() => setRange(t)} className="px-2.5 py-1 text-xs rounded-md border border-[#2a2d45] text-[#7e849e] bg-[#1c1f2e] hover:border-[#6c63ff] hover:text-white transition-all">近{t.replace('d','天')}</button>
              ))}
              {productMonths.map(m => (
                <button key={m} onClick={() => setRange(m)} className="px-2.5 py-1 text-xs rounded-md border border-[#2a2d45] text-[#7e849e] bg-[#1c1f2e] hover:border-[#6c63ff] hover:text-white transition-all">{m}</button>
              ))}
              <button onClick={() => setRange('all')} className="px-2.5 py-1 text-xs rounded-md border border-[#2a2d45] text-[#7e849e] bg-[#1c1f2e] hover:border-[#6c63ff] hover:text-white transition-all">全部</button>
              <div className="ml-auto flex items-center gap-2 text-xs text-[#444870]">
                <span>从</span>
                <input type="date" value={filterStart} min={minDate} max={maxDate} onChange={e => setFilterStart(e.target.value)}
                  className="bg-[#1c1f2e] border border-[#2a2d45] rounded-md px-2 py-1 text-xs text-[#dde1f0] outline-none focus:border-[#6c63ff]" style={{colorScheme:'dark'}} />
                <span>至</span>
                <input type="date" value={filterEnd} min={minDate} max={maxDate} onChange={e => setFilterEnd(e.target.value)}
                  className="bg-[#1c1f2e] border border-[#2a2d45] rounded-md px-2 py-1 text-xs text-[#dde1f0] outline-none focus:border-[#6c63ff]" style={{colorScheme:'dark'}} />
              </div>
              <div className="text-[11px] text-[#444870]">{filteredDaily.length} 天</div>
            </div>

            {/* KPI 卡 */}
            {agg && (
              <div className="grid grid-cols-5 gap-3 mb-6">
                {[
                  { label: '📦 总订单',  value: agg.totalOrders,   sub: '成交+退货',                        color: '' },
                  { label: '📦 总件数',  value: agg.totalUnits,    sub: '',                                 color: '' },
                  { label: '🌿 自然流',  value: agg.totalOrganic,  sub: `${pct(agg.totalOrganic, agg.totalOrders)}% 占总单`, color: 'text-[#3ecf8e]' },
                  { label: '📣 广告流',  value: agg.totalPaid,     sub: `${pct(agg.totalPaid, agg.totalOrders)}% 占总单`,   color: 'text-[#f5a623]' },
                  { label: '🔄 退货',    value: agg.totalRefund,   sub: `${pct(agg.totalRefund, agg.totalOrders)}% 退货率`, color: 'text-[#e85d75]' },
                ].map(c => (
                  <div key={c.label} className="bg-[#13151f] border border-[#2a2d45] rounded-xl p-4">
                    <div className="text-[11px] text-[#444870] uppercase tracking-wider mb-2">{c.label}</div>
                    <div className={`text-2xl font-bold tracking-tight ${c.color}`}>{c.value.toLocaleString()}</div>
                    {c.sub && <div className="text-xs text-[#444870] mt-1">{c.sub}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* 价格档明细 — 可收折 */}
            {agg && priceCount > 0 && (
              <div className="bg-[#13151f] border border-[#2a2d45] rounded-xl overflow-hidden mb-6">
                <button
                  onClick={() => setPriceExpanded(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-[#1c1f2e] hover:bg-[#242840] transition-all">
                  <span className="text-[11px] font-semibold text-[#444870] uppercase tracking-wider">
                    💰 价格档明细 <span className="text-[#363a58]">({priceCount} 档)</span>
                  </span>
                  <svg className={`w-4 h-4 text-[#444870] transition-transform ${priceExpanded ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {priceExpanded && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#1c1f2e]">
                        {['价格','订单','件数','自然流','广告流','退货','退货率','占比'].map(h => (
                          <th key={h} className="px-4 py-2 text-left text-[11px] text-[#444870] font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(agg.prices).sort((a,b)=>b[1].orders-a[1].orders).map(([price, pd]) => {
                        const sharePct  = pct(pd.orders, agg.totalOrders)
                        const orgPct    = pct(pd.organic, pd.orders)
                        const paidPct   = pct(pd.paid, pd.orders)
                        const refundPct = pct(pd.refund ?? 0, pd.orders)
                        return (
                          <tr key={price} className="border-t border-[#2a2d45] hover:bg-[rgba(255,255,255,0.02)]">
                            <td className="px-4 py-2"><span className="bg-[rgba(108,99,255,0.15)] text-[#6c63ff] px-1.5 py-0.5 rounded text-[11px] font-semibold">${parseFloat(price).toFixed(2)}</span></td>
                            <td className="px-4 py-2 tabular-nums">{pd.orders.toLocaleString()}</td>
                            <td className="px-4 py-2 tabular-nums">{pd.units.toLocaleString()}</td>
                            <td className="px-4 py-2 tabular-nums text-[#3ecf8e]">{pd.organic.toLocaleString()} <span className="text-[11px] text-[#444870]">{orgPct}%</span></td>
                            <td className="px-4 py-2 tabular-nums text-[#f5a623]">{pd.paid.toLocaleString()} <span className="text-[11px] text-[#444870]">{paidPct}%</span></td>
                            <td className="px-4 py-2 tabular-nums text-[#e85d75]">{(pd.refund ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-2 tabular-nums text-[11px] text-[#e85d75]">{refundPct}%</td>
                            <td className="px-4 py-2 tabular-nums text-[11px] text-[#444870]">{sharePct}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* 趋势图 */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[11px] font-semibold text-[#444870] uppercase tracking-widest">📈 每日订单趋势</span>
                <div className="flex-1 h-px bg-[#2a2d45]" />
              </div>
              <div className="bg-[#13151f] border border-[#2a2d45] rounded-xl p-5">
                <canvas ref={canvasRef} height={220} onMouseMove={handleCanvasMove} onMouseLeave={() => setTooltip(null)} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="fixed z-50 pointer-events-none bg-[#242840] border border-[#363a58] rounded-xl p-3.5 shadow-2xl min-w-[200px]"
          style={{ left: tooltip.x + 220 > window.innerWidth ? tooltip.x - 234 : tooltip.x + 14, top: Math.max(8, tooltip.y - 80) }}>
          <div className="text-xs font-bold text-[#dde1f0] mb-2 pb-2 border-b border-[#2a2d45]">{tooltip.date}</div>
          {!tooltip.entry ? <div className="text-xs text-[#444870]">无订单</div> : (() => {
            const e = tooltip.entry
            const rows = [
              { k: '📦 总订单', v: String(e.total_orders), sub: '成交+退货', color: '' },
              { k: '📦 总件数', v: String(e.total_units),  sub: '', color: '' },
              { k: '🌿 自然流', v: String(e.organic_orders), sub: `${pct(e.organic_orders, e.total_orders)}%`, color: 'text-[#3ecf8e]' },
              { k: '📣 广告流', v: String(e.paid_orders),    sub: `${pct(e.paid_orders, e.total_orders)}%`,   color: 'text-[#f5a623]' },
              { k: '🔄 退货',   v: String(e.refund_orders ?? 0), sub: `${pct(e.refund_orders ?? 0, e.total_orders)}%`, color: 'text-[#e85d75]' },
            ]
            return (
              <>
                {rows.map(({ k, v, sub, color }) => (
                  <div key={k} className="flex justify-between text-xs mb-1">
                    <span className="text-[#7e849e]">{k}</span>
                    <span className={`font-semibold ${color}`}>
                      {v} {sub && <span className="text-[#444870] text-[10px]">{sub}</span>}
                    </span>
                  </div>
                ))}
                {Object.entries(e.prices).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#2a2d45]">
                    {Object.entries(e.prices).sort((a,b)=>b[1].orders-a[1].orders).map(([price, pd]) => (
                      <div key={price} className="flex items-center gap-1.5 text-[11px] mb-1">
                        <span className="bg-[rgba(108,99,255,0.15)] text-[#6c63ff] px-1.5 py-px rounded font-semibold min-w-[42px] text-center">${parseFloat(price).toFixed(2)}</span>
                        <span className="font-semibold text-[#dde1f0] min-w-[20px]">{pd.orders}</span>
                        <span className="text-[#3ecf8e]">自然{pd.organic}</span>
                        {pd.paid > 0 && <span className="text-[#f5a623]">广告{pd.paid}</span>}
                        {(pd.refund ?? 0) > 0 && <span className="text-[#e85d75]">退{pd.refund}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-lg bg-[#242840] border border-[#363a58] text-sm shadow-xl z-50">{toast}</div>}
    </div>
  )
}
