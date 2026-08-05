import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// 获取是否已设置密码（不返回密码本身）
export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { data } = await supabaseAdmin.from('tenants').select('upload_password').eq('id', user.id).single()
  return NextResponse.json({ hasPassword: !!data?.upload_password })
}

// 设置/更新上传密码
export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { password } = await req.json()
  if (!password || password.length < 4) {
    return NextResponse.json({ error: '密码至少4位' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('tenants')
    .update({ upload_password: password })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
