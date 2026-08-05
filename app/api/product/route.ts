import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, supabaseAdmin } from '@/lib/supabase-server'

async function getTenantAndVerify(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const password = req.headers.get('x-upload-password')
  const { data: tenant } = await supabaseAdmin
    .from('tenants').select('upload_password').eq('id', user.id).single()
  if (!tenant?.upload_password || password !== tenant.upload_password) return null

  return user.id
}

export async function PATCH(req: NextRequest) {
  const tenantId = await getTenantAndVerify(req)
  if (!tenantId) return NextResponse.json({ error: '验证失败' }, { status: 401 })

  const { id, internal_name } = await req.json()
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('products').update({ internal_name }).eq('id', id).eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const tenantId = await getTenantAndVerify(req)
  if (!tenantId) return NextResponse.json({ error: '验证失败' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  // 同时删除该商品的所有订单数据
  await supabaseAdmin.from('creator_commission').delete().eq('product_id', id).eq('tenant_id', tenantId)
  await supabaseAdmin.from('creator_daily').delete().eq('product_id', id).eq('tenant_id', tenantId)
  await supabaseAdmin.from('daily_prices').delete().eq('product_id', id).eq('tenant_id', tenantId)
  await supabaseAdmin.from('daily_orders').delete().eq('product_id', id).eq('tenant_id', tenantId)

  const { error } = await supabaseAdmin
    .from('products').delete().eq('id', id).eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const tenantId = await getTenantAndVerify(req)
  if (!tenantId) return NextResponse.json({ error: '验证失败' }, { status: 401 })

  const { id, internal_name } = await req.json()
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('products')
    .upsert({ id, tenant_id: tenantId, internal_name, full_name: '' }, { onConflict: 'id,tenant_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
