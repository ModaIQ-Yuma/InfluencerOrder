import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

async function getUser() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// GET: 获取BD成员、绑定关系、模式
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const [members, assignments, tenant] = await Promise.all([
    supabaseAdmin.from('bd_members').select('*').eq('tenant_id', user.id).order('name'),
    supabaseAdmin.from('bd_assignments').select('*').eq('tenant_id', user.id),
    supabaseAdmin.from('tenants').select('bd_mode').eq('id', user.id).single(),
  ])

  return NextResponse.json({
    members: members.data || [],
    assignments: assignments.data || [],
    bd_mode: tenant.data?.bd_mode || null,
  })
}

// POST: 创建BD成员 / 保存绑定 / 设置模式
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const body = await req.json()
  const { action } = body

  if (action === 'set_mode') {
    const { mode } = body
    const { error } = await supabaseAdmin.from('tenants').update({ bd_mode: mode }).eq('id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'add_member') {
    const { name } = body
    if (!name?.trim()) return NextResponse.json({ error: '名称不能为空' }, { status: 400 })
    const { data, error } = await supabaseAdmin.from('bd_members')
      .insert({ tenant_id: user.id, name: name.trim() }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, member: data })
  }

  if (action === 'delete_member') {
    const { id } = body
    await supabaseAdmin.from('bd_assignments').delete().eq('bd_id', id).eq('tenant_id', user.id)
    await supabaseAdmin.from('bd_members').delete().eq('id', id).eq('tenant_id', user.id)
    return NextResponse.json({ ok: true })
  }

  if (action === 'rename_member') {
    const { id, name } = body
    if (!name?.trim()) return NextResponse.json({ error: '名称不能为空' }, { status: 400 })
    const { error } = await supabaseAdmin.from('bd_members')
      .update({ name: name.trim() }).eq('id', id).eq('tenant_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'assign') {
    const { creator, product_id, bd_id } = body
    if (!creator) return NextResponse.json({ error: '缺少达人' }, { status: 400 })

    if (!bd_id) {
      // 取消绑定
      let q = supabaseAdmin.from('bd_assignments').delete().eq('tenant_id', user.id).eq('creator', creator)
      if (product_id) q = q.eq('product_id', product_id)
      else q = q.is('product_id', null)
      await q
      return NextResponse.json({ ok: true })
    }

    // upsert绑定
    const match = product_id
      ? { tenant_id: user.id, creator, product_id }
      : { tenant_id: user.id, creator, product_id: null }

    await supabaseAdmin.from('bd_assignments').delete().match(match)
    await supabaseAdmin.from('bd_assignments').insert({ tenant_id: user.id, creator, product_id: product_id || null, bd_id })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 })
}
