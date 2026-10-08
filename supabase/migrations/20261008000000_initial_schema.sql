-- Kitcha's Food — initial schema.
-- Rebuilt from scratch per the master prompt spec (business rules, data model, RLS
-- conventions in section C10). For each table: CREATE TABLE -> GRANT -> ENABLE RLS
-- -> CREATE POLICY, in that order, so nothing is ever briefly exposed without policies.
--
-- Known intentional gaps, left for Manoj to fill in rather than guessed at:
--   * protein_diet_plans.calories/protein_grams/carbs_grams/fat_grams are nullable —
--     no real nutrition numbers exist in any source document.
--   * inventory_items is NOT seeded here — the "49 master items" mentioned in the
--     project history were never captured anywhere Claude has access to; seeding
--     fabricated item names/quantities would violate the project's working
--     agreement against inventing business facts. Seed this once Manoj provides
--     the real list (a follow-up migration, not a schema change).

create extension if not exists pgcrypto;

-- ============================================================================
-- ENUMS
-- ============================================================================
create type public.app_role as enum (
  'admin', 'chef', 'kitchen_staff', 'cash_counter', 'accountant', 'inventory_manager', 'delivery_driver'
);

create type public.customer_type as enum ('KITCHAS_CUSTOMER', 'KBR_CUSTOMER', 'YUBI_CUSTOMER');

create type public.kitchen_type as enum ('veg', 'nonveg');

create type public.meal_time as enum ('breakfast', 'brunch', 'lunch', 'evening_snacks', 'dinner');

create type public.day_of_week as enum ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday');

create type public.order_status as enum (
  'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'
);

create type public.subscription_plan as enum ('3_days', '1_week', '2_weeks', '1_month', '3_months');

create type public.subscription_status as enum ('active', 'paused', 'cancelled', 'completed');

create type public.age_category as enum ('kids', 'teens', 'adults', 'seniors');

-- ============================================================================
-- profiles — one row per auth user. Roles are NEVER stored here (see user_roles).
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  customer_type public.customer_type,
  phone text,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'ta', 'hi')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id);

-- ============================================================================
-- user_roles — the ONLY place roles live. Staff accounts are created by an
-- admin; customers never get a row here.
-- ============================================================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant select, insert, update, delete on public.user_roles to service_role;

alter table public.user_roles enable row level security;

-- Security-definer functions — the ONLY sanctioned way to check a role.
-- STABLE + SECURITY DEFINER so RLS policies that call them don't recurse into
-- user_roles' own RLS (which would deadlock).
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

create policy "Users can view their own roles"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "Admins manage roles"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- menu_categories / menu_items / menu_availability / menu_visibility
-- ============================================================================
create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kitchen_type public.kitchen_type not null,
  description text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories(id) on delete cascade,
  name text not null,
  description text,
  half_price numeric(10, 2),
  full_price numeric(10, 2) not null default 0,
  kitchen_type public.kitchen_type not null,
  is_veg boolean not null default true,
  is_available boolean not null default true,
  is_preorder_only boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index menu_items_category_id_idx on public.menu_items (category_id);

create table public.menu_availability (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  day_of_week public.day_of_week not null,
  meal_time public.meal_time,
  created_at timestamptz not null default now(),
  unique (menu_item_id, day_of_week, meal_time)
);

-- Which customer_type(s) may see a category. No rows for a category = visible
-- to everyone (that's the default for the plain Kitcha's counter categories).
-- Rows present = restricted to exactly the customer_types listed (used for the
-- KBR/YUBI-only corporate categories). This is what actually enforces
-- customer-type menu visibility server-side, per the priority backlog item.
create table public.menu_visibility (
  id uuid primary key default gen_random_uuid(),
  menu_category_id uuid not null references public.menu_categories(id) on delete cascade,
  customer_type public.customer_type not null,
  created_at timestamptz not null default now(),
  unique (menu_category_id, customer_type)
);

create or replace function public.can_view_category(_category_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    public.is_staff(auth.uid())
    or not exists (select 1 from public.menu_visibility mv where mv.menu_category_id = _category_id)
    or exists (
      select 1
      from public.menu_visibility mv
      join public.profiles p on p.customer_type = mv.customer_type
      where mv.menu_category_id = _category_id and p.id = auth.uid()
    )
$$;

grant select on public.menu_categories, public.menu_items, public.menu_availability, public.menu_visibility
  to anon, authenticated;
grant insert, update, delete on public.menu_categories, public.menu_items, public.menu_availability, public.menu_visibility
  to authenticated;
grant all on public.menu_categories, public.menu_items, public.menu_availability, public.menu_visibility
  to service_role;

alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_availability enable row level security;
alter table public.menu_visibility enable row level security;

create policy "Anyone can view active, visible categories"
  on public.menu_categories for select to anon, authenticated
  using (is_active and public.can_view_category(id));

create policy "Admins manage categories"
  on public.menu_categories for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Anyone can view available, visible items"
  on public.menu_items for select to anon, authenticated
  using (
    public.is_staff(auth.uid())
    or (
      is_available
      and exists (
        select 1 from public.menu_categories c
        where c.id = menu_items.category_id and c.is_active and public.can_view_category(c.id)
      )
    )
  );

create policy "Admins manage items"
  on public.menu_items for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Anyone can view availability rows"
  on public.menu_availability for select to anon, authenticated using (true);

create policy "Admins manage availability"
  on public.menu_availability for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Anyone can view visibility rows"
  on public.menu_visibility for select to anon, authenticated using (true);

create policy "Admins manage visibility"
  on public.menu_visibility for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- inventory_items / inventory_transactions — staff-only, never customer-facing.
-- ============================================================================
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null,
  current_quantity numeric(10, 2) not null default 0,
  reorder_threshold numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('in', 'out')),
  quantity numeric(10, 2) not null,
  reference_order_id uuid,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.inventory_items, public.inventory_transactions to authenticated;
grant all on public.inventory_items, public.inventory_transactions to service_role;

alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;

create policy "Staff can view inventory"
  on public.inventory_items for select to authenticated
  using (public.is_staff(auth.uid()));

create policy "Inventory managers and admins manage inventory"
  on public.inventory_items for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'inventory_manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'inventory_manager'));

create policy "Staff can view inventory transactions"
  on public.inventory_transactions for select to authenticated
  using (public.is_staff(auth.uid()));

create policy "Inventory managers and admins manage transactions"
  on public.inventory_transactions for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'inventory_manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'inventory_manager'));

-- ============================================================================
-- orders / order_items
-- ============================================================================
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.order_status not null default 'pending',
  order_type text not null default 'retail' check (order_type in ('retail', 'preorder')),
  total_amount numeric(10, 2) not null default 0,
  delivery_address text,
  delivery_charge numeric(10, 2) not null default 0,
  payment_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id),
  portion text check (portion in ('half', 'full')),
  quantity int not null default 1 check (quantity > 0),
  unit_price numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

create index orders_user_id_idx on public.orders (user_id);
create index order_items_order_id_idx on public.order_items (order_id);

grant select, insert, update on public.orders to authenticated;
grant select, insert on public.order_items to authenticated;
grant all on public.orders, public.order_items to service_role;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Users can view their own orders"
  on public.orders for select to authenticated
  using (auth.uid() = user_id or public.is_staff(auth.uid()));

create policy "Users can create their own orders"
  on public.orders for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Staff can update orders"
  on public.orders for update to authenticated
  using (public.is_staff(auth.uid()));

create policy "Users can view their own order items"
  on public.order_items for select to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
  );

create policy "Users can add items to their own orders"
  on public.order_items for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid()));

-- ============================================================================
-- catering_orders — min 10 guests / advance window / 25% deposit are enforced
-- in the application layer (not practical to express the date-math in a CHECK
-- constraint portably); the schema just stores what was agreed.
-- ============================================================================
create table public.catering_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('party', 'corporate', 'event_wedding')),
  guest_count int not null check (guest_count >= 10),
  event_date date not null,
  delivery_time time,
  venue_address text not null,
  contact_person text not null,
  contact_phone text not null,
  special_requests text,
  items jsonb not null default '[]'::jsonb,
  status public.order_status not null default 'pending',
  distance_km numeric(6, 2),
  delivery_charge numeric(10, 2),
  total_amount numeric(10, 2) not null default 0,
  advance_amount numeric(10, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index catering_orders_user_id_idx on public.catering_orders (user_id);

grant select, insert, update on public.catering_orders to authenticated;
grant all on public.catering_orders to service_role;

alter table public.catering_orders enable row level security;

create policy "Users can view their own catering orders"
  on public.catering_orders for select to authenticated
  using (auth.uid() = user_id or public.is_staff(auth.uid()));

create policy "Users can create their own catering orders"
  on public.catering_orders for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own pending catering orders"
  on public.catering_orders for update to authenticated
  using (auth.uid() = user_id or public.is_staff(auth.uid()));

-- ============================================================================
-- protein_subscriptions / subscription_deliveries
-- ============================================================================
create table public.protein_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  age_category public.age_category not null,
  plan public.subscription_plan not null,
  is_veg boolean not null default true,
  base_price numeric(10, 2) not null,
  discount_percent numeric(5, 2) not null default 0,
  total_price numeric(10, 2) not null,
  status public.subscription_status not null default 'active',
  start_date date not null,
  end_date date not null,
  delivery_time time,
  delivery_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.protein_subscriptions(id) on delete cascade,
  delivery_date date not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'delivered', 'skipped', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (subscription_id, delivery_date)
);

create index protein_subscriptions_user_id_idx on public.protein_subscriptions (user_id);

grant select, insert, update on public.protein_subscriptions to authenticated;
grant select on public.subscription_deliveries to authenticated;
grant all on public.protein_subscriptions, public.subscription_deliveries to service_role;

alter table public.protein_subscriptions enable row level security;
alter table public.subscription_deliveries enable row level security;

create policy "Users can view their own subscriptions"
  on public.protein_subscriptions for select to authenticated
  using (auth.uid() = user_id or public.is_staff(auth.uid()));

create policy "Users can create their own subscriptions"
  on public.protein_subscriptions for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own subscriptions"
  on public.protein_subscriptions for update to authenticated
  using (auth.uid() = user_id or public.is_staff(auth.uid()));

create policy "Users can view their own subscription deliveries"
  on public.subscription_deliveries for select to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (
      select 1 from public.protein_subscriptions s
      where s.id = subscription_deliveries.subscription_id and s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- protein_diet_plans — reference data (not per-user). calories/macros are
-- intentionally nullable: no real nutrition numbers exist in any source
-- document yet (see migration header note).
-- ============================================================================
create table public.protein_diet_plans (
  id uuid primary key default gen_random_uuid(),
  age_category public.age_category not null,
  is_veg boolean not null,
  day_of_week public.day_of_week not null,
  meal_time public.meal_time not null,
  description text not null,
  calories int,
  protein_grams numeric(5, 2),
  carbs_grams numeric(5, 2),
  fat_grams numeric(5, 2),
  created_at timestamptz not null default now(),
  unique (age_category, is_veg, day_of_week, meal_time)
);

grant select on public.protein_diet_plans to anon, authenticated;
grant insert, update, delete on public.protein_diet_plans to authenticated;
grant all on public.protein_diet_plans to service_role;

alter table public.protein_diet_plans enable row level security;

create policy "Anyone can view diet plans"
  on public.protein_diet_plans for select to anon, authenticated using (true);

create policy "Admins manage diet plans"
  on public.protein_diet_plans for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- preorders / preorder_items
-- ============================================================================
create table public.preorders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_date date not null,
  scheduled_time time not null,
  delivery_address text,
  contact_phone text,
  status public.order_status not null default 'pending',
  total_amount numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.preorder_items (
  id uuid primary key default gen_random_uuid(),
  preorder_id uuid not null references public.preorders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id),
  portion text check (portion in ('half', 'full')),
  quantity int not null default 1 check (quantity > 0),
  unit_price numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

create index preorders_user_id_idx on public.preorders (user_id);
create index preorder_items_preorder_id_idx on public.preorder_items (preorder_id);

grant select, insert, update on public.preorders to authenticated;
grant select, insert on public.preorder_items to authenticated;
grant all on public.preorders, public.preorder_items to service_role;

alter table public.preorders enable row level security;
alter table public.preorder_items enable row level security;

create policy "Users can view their own preorders"
  on public.preorders for select to authenticated
  using (auth.uid() = user_id or public.is_staff(auth.uid()));

create policy "Users can create their own preorders"
  on public.preorders for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own preorders"
  on public.preorders for update to authenticated
  using (auth.uid() = user_id or public.is_staff(auth.uid()));

create policy "Users can view their own preorder items"
  on public.preorder_items for select to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (select 1 from public.preorders p where p.id = preorder_items.preorder_id and p.user_id = auth.uid())
  );

create policy "Users can add items to their own preorders"
  on public.preorder_items for insert to authenticated
  with check (exists (select 1 from public.preorders p where p.id = preorder_items.preorder_id and p.user_id = auth.uid()));
