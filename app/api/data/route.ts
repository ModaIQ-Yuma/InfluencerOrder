import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll(supabase: any, table: string, select: string): Promise<any[]> {
  const PAGE = 1000
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data || data.length === 0) break
    rows = rows.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return rows
}

// phase=1：轻量首屏数据
// phase=2：重量详情数据
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const phase = req.nextUrl.searchParams.get('phase') || '1'

  if (phase === '1') {
    const [products, dailyOrders, bdMembers, bdAssignments, tenant] = await Promise.all([
      fetchAll(supabase, 'products', '*'),
      fetchAll(supabase, 'daily_orders', '*'),
      supabaseAdmin.from('bd_members').select('*').eq('tenant_id', user.id).order('name'),
      supabaseAdmin.from('bd_assignments').select('*').eq('tenant_id', user.id),
      supabaseAdmin.from('tenants').select('bd_mode').eq('id', user.id).single(),
    ])

    // daily_orders 不含价格明细，prices 为空对象占位
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const daily = dailyOrders.map((d: any) => ({
      ...d,
      refund_orders: d.refund_orders ?? 0,
      prices: {},
    }))

    return NextResponse.json({
      products,
      daily,
      creatorDaily: [],
      creatorCommission: [],
      bdMembers: bdMembers.data || [],
      bdAssignments: bdAssignments.data || [],
      bdMode: tenant.data?.bd_mode || null,
      phase: 1,
    })
  }

  // phase=2：价格档 + 达人数据
  const [dailyPrices, creatorDaily, creatorCommission] = await Promise.all([
    fetchAll(supabase, 'daily_prices', '*'),
    fetchAll(supabase, 'creator_daily', '*'),
    fetchAll(supabase, 'creator_commission', '*'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceMap: Record<string, Record<string, any>> = {}
  for (const p of dailyPrices) {
    const key = `${p.product_id}__${p.date}`
    if (!priceMap[key]) priceMap[key] = {}
    priceMap[key][String(p.unit_price)] = {
      orders: p.orders, units: p.units,
      organic: p.organic, paid: p.paid, refund: p.refund ?? 0,
    }
  }

  return NextResponse.json({
    priceMap,
    creatorDaily,
    creatorCommission,
    phase: 2,
  })
}
