import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, supabaseAdmin } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function parseDate(val: unknown): string | null {
  if (!val) return null
  const s = String(val).trim()
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  const m2 = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m2) return m2[1]
  return null
}

function rateStr(val: unknown): string {
  if (val == null || val === '') return ''
  return String(val).trim()
}

export async function POST(req: NextRequest) {
  // 验证登录
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const tenantId = user.id

  // 验证上传密码
  const password = req.headers.get('x-upload-password')
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('upload_password')
    .eq('id', tenantId)
    .single()

  if (!tenant?.upload_password) {
    return NextResponse.json({ error: '请先在设置中设置上传密码' }, { status: 401 })
  }
  if (password !== tenant.upload_password) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: '未收到文件' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, unknown>[]

  const productMap: Record<string, { id: string; fullName: string }> = {}

  const dayBuf: Record<string, {
    productId: string; date: string
    orders: { units: number; price: number; isOrganic: boolean; isPaid: boolean; isRefund: boolean }[]
  }> = {}

  const creatorBuf: Record<string, {
    productId: string; date: string; creator: string; channel: string
    orders: number; organic: number; paid: number; refund: number
  }> = {}

  const commBuf: Record<string, {
    productId: string; date: string; creator: string
    commissionType: string; commissionRate: string; orders: number
  }> = {}

  let skipped = 0

  for (const row of rows) {
    const payDate = parseDate(row['支付时间'])
    if (!payDate) { skipped++; continue }

    const pid      = String(row['商品 ID'] || row['商品ID'] || '').trim()
    const fullName = String(row['商品名称 '] || row['商品名称'] || '').trim()
    const units    = parseInt(String(row['下单件数'] || '1')) || 1
    const estComm  = parseFloat(String(row['预估计佣金额'] || '0')) || 0
    const unitPrice = Math.round((estComm / units) * 100) / 100
    const isRefund  = row['已全部退货或全额退款'] === '是'
    const stdRate   = rateStr(row['标准佣金率'])
    const adRate    = rateStr(row['店铺广告佣金率'])
    const isOrganic = !isRefund && stdRate !== ''
    const isPaid    = !isRefund && adRate !== ''
    const creator   = String(row['达人用户名'] || '').trim()
    const channel   = String(row['内容形式'] || '').trim()

    if (!pid) { skipped++; continue }

    if (!productMap[pid]) productMap[pid] = { id: pid, fullName }

    const dayKey = `${pid}__${payDate}`
    if (!dayBuf[dayKey]) dayBuf[dayKey] = { productId: pid, date: payDate, orders: [] }
    dayBuf[dayKey].orders.push({ units, price: unitPrice, isOrganic, isPaid, isRefund })

    if (creator) {
      const ck = `${pid}__${payDate}__${creator}__${channel}`
      if (!creatorBuf[ck]) creatorBuf[ck] = { productId: pid, date: payDate, creator, channel, orders: 0, organic: 0, paid: 0, refund: 0 }
      creatorBuf[ck].orders++
      if (isOrganic) creatorBuf[ck].organic++
      if (isPaid)    creatorBuf[ck].paid++
      if (isRefund)  creatorBuf[ck].refund++

      if (!isRefund && stdRate) {
        const commKey = `${pid}__${payDate}__${creator}__organic__${stdRate}`
        if (!commBuf[commKey]) commBuf[commKey] = { productId: pid, date: payDate, creator, commissionType: 'organic', commissionRate: stdRate, orders: 0 }
        commBuf[commKey].orders++
      }
      if (!isRefund && adRate) {
        const commKey = `${pid}__${payDate}__${creator}__paid__${adRate}`
        if (!commBuf[commKey]) commBuf[commKey] = { productId: pid, date: payDate, creator, commissionType: 'paid', commissionRate: adRate, orders: 0 }
        commBuf[commKey].orders++
      }
    }
  }

  // Upsert products（带 tenant_id）
  for (const p of Object.values(productMap)) {
    const { data: existing } = await supabaseAdmin
      .from('products').select('id').eq('id', p.id).eq('tenant_id', tenantId).single()
    if (!existing) {
      await supabaseAdmin.from('products').insert({ id: p.id, tenant_id: tenantId, full_name: p.fullName, internal_name: '' })
    } else if (p.fullName) {
      await supabaseAdmin.from('products').update({ full_name: p.fullName }).eq('id', p.id).eq('tenant_id', tenantId)
    }
  }

  // Build daily rows
  const dailyRows: Record<string, unknown>[] = []
  const priceRows: Record<string, unknown>[] = []

  for (const buf of Object.values(dayBuf)) {
    const { productId, date, orders } = buf
    let totalOrders = 0, totalUnits = 0, totalOrganic = 0, totalPaid = 0, totalRefund = 0
    const priceMap: Record<number, { orders: number; units: number; organic: number; paid: number; refund: number }> = {}

    for (const o of orders) {
      totalOrders++
      if (!o.isRefund) totalUnits += o.units
      if (o.isOrganic) totalOrganic++
      if (o.isPaid)    totalPaid++
      if (o.isRefund)  totalRefund++
      if (!priceMap[o.price]) priceMap[o.price] = { orders: 0, units: 0, organic: 0, paid: 0, refund: 0 }
      priceMap[o.price].orders++
      if (!o.isRefund) priceMap[o.price].units += o.units
      if (o.isOrganic) priceMap[o.price].organic++
      if (o.isPaid)    priceMap[o.price].paid++
      if (o.isRefund)  priceMap[o.price].refund++
    }

    dailyRows.push({ tenant_id: tenantId, product_id: productId, date, total_orders: totalOrders, total_units: totalUnits, organic_orders: totalOrganic, paid_orders: totalPaid, refund_orders: totalRefund })
    for (const [price, pd] of Object.entries(priceMap)) {
      priceRows.push({ tenant_id: tenantId, product_id: productId, date, unit_price: parseFloat(price), ...pd })
    }
  }

  const creatorRows = Object.values(creatorBuf).map(c => ({
    tenant_id: tenantId, product_id: c.productId, date: c.date, creator: c.creator, channel: c.channel,
    orders: c.orders, organic_orders: c.organic, paid_orders: c.paid, refund_orders: c.refund,
  }))

  const commRows = Object.values(commBuf).map(c => ({
    tenant_id: tenantId, product_id: c.productId, date: c.date, creator: c.creator,
    commission_type: c.commissionType, commission_rate: c.commissionRate, orders: c.orders,
  }))

  const batchUpsert = async (table: string, data: Record<string, unknown>[], conflict: string) => {
    for (let i = 0; i < data.length; i += 500) {
      const { error } = await supabaseAdmin.from(table).upsert(data.slice(i, i + 500), { onConflict: conflict })
      if (error) throw new Error(`${table}: ${error.message}`)
    }
  }

  await batchUpsert('daily_orders',       dailyRows,  'tenant_id,product_id,date')
  await batchUpsert('daily_prices',       priceRows,  'tenant_id,product_id,date,unit_price')
  await batchUpsert('creator_daily',      creatorRows,'tenant_id,product_id,date,creator,channel')
  await batchUpsert('creator_commission', commRows,   'tenant_id,product_id,date,creator,commission_type,commission_rate')

  return NextResponse.json({
    ok: true,
    imported: Object.values(dayBuf).reduce((s, b) => s + b.orders.length, 0),
    skipped,
    days: dailyRows.length,
    creators: creatorRows.length,
  })
}
