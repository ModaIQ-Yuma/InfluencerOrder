import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, supabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const password = req.headers.get('x-upload-password')
  const { data: tenant } = await supabaseAdmin
    .from('tenants').select('upload_password').eq('id', user.id).single()
  if (!tenant?.upload_password || password !== tenant.upload_password) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 })
  }

  const tenantId = user.id
  // 只清除当前租户的订单数据，保留商品和内部名称
  await supabaseAdmin.from('creator_commission').delete().eq('tenant_id', tenantId)
  await supabaseAdmin.from('creator_daily').delete().eq('tenant_id', tenantId)
  await supabaseAdmin.from('daily_prices').delete().eq('tenant_id', tenantId)
  await supabaseAdmin.from('daily_orders').delete().eq('tenant_id', tenantId)

  return NextResponse.json({ ok: true })
}
