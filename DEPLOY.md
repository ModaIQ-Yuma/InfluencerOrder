# InfluencerOrder SaaS · 部署指南

## 第一步：Supabase 建表

1. 打开 [supabase.com](https://supabase.com) → 进入你的项目（或新建一个）
2. 左侧 → **SQL Editor** → New query
3. 把 `supabase-schema.sql` 全部内容粘贴进去 → Run
4. 完成后 Table Editor 里应看到：`tenants`, `products`, `daily_orders`, `daily_prices`, `creator_daily`, `creator_commission`

> **重要**：`supabase-schema.sql` 里包含一个 trigger，用户注册时会自动在 `tenants` 表创建对应记录。

## 第二步：获取 Supabase 密钥

左侧 → Project Settings → API，复制：
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key**（往下翻） → `SUPABASE_SERVICE_ROLE_KEY`

## 第三步：推送到 GitHub

```bash
cd influencerorder-saas
git init
git add .
git commit -m "init InfluencerOrder SaaS"
git remote add origin https://github.com/ModaIQ-Yuma/InfluencerOredr.git
git push -u origin main
```

## 第四步：Vercel 部署

1. 打开 [vercel.com](https://vercel.com) → Add New Project
2. 选择 `InfluencerOredr` 仓库 → Import
3. Framework 自动识别为 Next.js
4. 展开 **Environment Variables**，添加三个：

| 变量名 | 值 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |

5. Deploy → 等约 1 分钟

## 日常使用

### 用户流程
1. 打开网站 → 注册邮箱账号
2. 检查邮箱，点击验证链接（Supabase 默认要求邮箱验证）
3. 登录后，点击右上角邮箱 → 设置上传密码
4. 进入「商品档案」页 → 输入上传密码 → 上传 .xlsx 文件
5. 查看各分析 Tab

### 关于上传密码
- 与登录密码完全独立
- 刷新页面后需重新输入（存在 sessionStorage）
- 可随时在右上角菜单里修改

### 数据隔离
每个账号的数据完全独立，互不可见（Supabase RLS 保证）。

## Supabase 邮箱验证说明

默认情况下 Supabase 要求邮箱验证。如果你想让用户注册后直接可用（不用点邮件），在 Supabase Dashboard：
- Authentication → Providers → Email → 关闭 "Confirm email"
