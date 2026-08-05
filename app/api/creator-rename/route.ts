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

  const { oldName, newName } = await req.json()
  if (!oldName?.trim() || !newName?.trim()) {
    return NextResponse.json({ error: '原名和现名不能为空' }, { status: 400 })
  }
  if (oldName.trim() === newName.trim()) {
    return NextResponse.json({ error: '原名和现名相同' }, { status: 400 })
  }

  const tenantId = user.id
  for (const table of ['creator_daily', 'creator_commission']) {
    const { error } = await supabaseAdmin
      .from(table)
      .update({ creator: newName.trim() })
      .eq('creator', oldName.trim())
      .eq('tenant_id', tenantId)
    if (error) return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
