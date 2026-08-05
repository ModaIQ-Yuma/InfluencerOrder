-- ============================================================
-- InfluencerOrder SaaS · Supabase Schema
-- 在 Supabase Dashboard → SQL Editor 里执行此文件
-- ============================================================

-- ── 租户配置表 ──────────────────────────────────────────────
-- 每个注册用户对应一条租户记录，注册时通过 trigger 自动创建
create table if not exists tenants (
  id uuid primary key references auth.users(id) on delete cascade,
  upload_password text not null default '',   -- 明文存储，用户自己设置
  created_at timestamptz default now()
);

alter table tenants enable row level security;

-- 用户只能读写自己的租户配置
create policy "tenant self read"   on tenants for select using (id = auth.uid());
create policy "tenant self update" on tenants for update using (id = auth.uid());

-- 注册时自动创建租户记录
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.tenants (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 商品表 ──────────────────────────────────────────────────
create table if not exists products (
  id text not null,
  tenant_id uuid not null references auth.users(id) on delete cascade,
  internal_name text not null default '',
  full_name text not null default '',
  created_at timestamptz default now(),
  primary key (id, tenant_id)
);

alter table products enable row level security;
create policy "products tenant rw" on products for all using (tenant_id = auth.uid());

-- ── 每日订单汇总表 ───────────────────────────────────────────
create table if not exists daily_orders (
  id serial primary key,
  tenant_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  date date not null,
  total_orders int not null default 0,
  total_units int not null default 0,
  organic_orders int not null default 0,
  paid_orders int not null default 0,
  refund_orders int not null default 0,
  unique(tenant_id, product_id, date)
);

alter table daily_orders enable row level security;
create policy "daily_orders tenant rw" on daily_orders for all using (tenant_id = auth.uid());

-- ── 每日价格档明细表 ─────────────────────────────────────────
create table if not exists daily_prices (
  id serial primary key,
  tenant_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  date date not null,
  unit_price numeric(10,2) not null,
  orders int not null default 0,
  units int not null default 0,
  organic int not null default 0,
  paid int not null default 0,
  refund int not null default 0,
  unique(tenant_id, product_id, date, unit_price)
);

alter table daily_prices enable row level security;
create policy "daily_prices tenant rw" on daily_prices for all using (tenant_id = auth.uid());

-- ── 达人每日明细表 ───────────────────────────────────────────
create table if not exists creator_daily (
  id serial primary key,
  tenant_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  date date not null,
  creator text not null,
  channel text not null default '',
  orders int not null default 0,
  organic_orders int not null default 0,
  paid_orders int not null default 0,
  refund_orders int not null default 0,
  unique(tenant_id, product_id, date, creator, channel)
);

alter table creator_daily enable row level security;
create policy "creator_daily tenant rw" on creator_daily for all using (tenant_id = auth.uid());

-- ── 达人佣金率分布表 ─────────────────────────────────────────
create table if not exists creator_commission (
  id serial primary key,
  tenant_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  date date not null,
  creator text not null,
  commission_type text not null,
  commission_rate text not null,
  orders int not null default 0,
  unique(tenant_id, product_id, date, creator, commission_type, commission_rate)
);

alter table creator_commission enable row level security;
create policy "creator_commission tenant rw" on creator_commission for all using (tenant_id = auth.uid());

-- ============================================================
-- 完成后在 Table Editor 里应能看到以下 5 张表：
--   tenants, products, daily_orders, daily_prices,
--   creator_daily, creator_commission
-- ============================================================

-- ============================================================
-- BD 功能扩展（在原 schema 基础上追加执行）
-- ============================================================

-- tenants 表加 bd_mode 列
alter table tenants add column if not exists bd_mode text check (bd_mode in ('creator','product','both'));

-- BD 成员表
create table if not exists bd_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);
alter table bd_members enable row level security;
create policy "bd_members tenant rw" on bd_members for all using (tenant_id = auth.uid());

-- BD 绑定关系表
create table if not exists bd_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id) on delete cascade,
  creator text not null,
  product_id text,   -- null 表示该达人所有产品
  bd_id uuid not null references bd_members(id) on delete cascade,
  created_at timestamptz default now()
);
alter table bd_assignments enable row level security;
create policy "bd_assignments tenant rw" on bd_assignments for all using (tenant_id = auth.uid());
