-- Seed the real Kitcha's Food and KBR menus into version control.
-- Source: KITCHAS_MASTER_PROMPT.md "Pricing (current authoritative list)", confirmed by
-- Manoj 2026-08-17 — same authoritative data used in the original project's migrations.
--
-- Visibility: Kitcha's categories have no menu_visibility rows, so can_view_category()
-- (see 20261008000000_initial_schema.sql) treats them as open to everyone, including
-- anonymous visitors browsing before signup — this is the public retail menu. The KBR
-- categories get explicit menu_visibility rows restricting them to KBR_CUSTOMER and
-- YUBI_CUSTOMER (no separate Yubi menu exists in any source document, so Yubi employees
-- see the same corporate categories as KBR per the master prompt's customer_type model).
--
-- Known gaps NOT seeded here (no fabricated prices — flag for Manoj):
--   * Dessert prices (Brownie, Brownie with Ice Cream, Cheesecake, Blueberry Cake) are
--     undocumented anywhere — boarded below as "Coming Soon" (is_available = false,
--     full_price = 0), same treatment as the original project's migration.
--   * "Gobi" (a Thursday KBR lunch item distinct from "Gobi Fried Rice") has no
--     documented price and is NOT seeded — Menu.tsx's day-filter arrays must not
--     reference an item name that doesn't exist here (this was a duplicate in the
--     original app, confirmed removed).

insert into public.menu_categories (name, kitchen_type, description, display_order, is_active) values
  ('Kitcha''s Breakfast', 'veg', 'Pure vegetarian breakfast, served all 7 days', 1, true),
  ('Kitcha''s Lunch', 'veg', 'Pure vegetarian lunch, Monday to Saturday', 2, true),
  ('Kitcha''s Dinner', 'veg', 'Pure vegetarian dinner, Monday to Saturday', 3, true),
  ('Desserts', 'veg', 'Coming soon', 4, true),
  ('KBR Breakfast', 'nonveg', 'Corporate breakfast menu — KBR and Yubi', 5, true),
  ('KBR Brunch', 'nonveg', 'Corporate brunch menu — KBR and Yubi', 6, true),
  ('KBR Lunch', 'nonveg', 'Corporate lunch menu, Monday to Friday — KBR and Yubi', 7, true),
  ('KBR Evening Snacks', 'nonveg', 'Corporate evening snacks, after 3:30 PM — KBR and Yubi', 8, true);

-- Restrict the four corporate categories to KBR/Yubi employees. Everything else has no
-- rows here at all, which can_view_category() treats as public.
insert into public.menu_visibility (menu_category_id, customer_type)
select c.id, ct.customer_type
from public.menu_categories c
cross join (values ('KBR_CUSTOMER'::public.customer_type), ('YUBI_CUSTOMER'::public.customer_type)) as ct(customer_type)
where c.name in ('KBR Breakfast', 'KBR Brunch', 'KBR Lunch', 'KBR Evening Snacks');

-- Kitcha's Breakfast (all 7 days)
with cat as (select id from public.menu_categories where name = 'Kitcha''s Breakfast')
insert into public.menu_items (category_id, name, half_price, full_price, kitchen_type, is_veg)
select cat.id, v.name, v.half_price, v.full_price, 'veg', true
from cat, (values
  ('Idly', null::decimal, 15::decimal),
  ('Vadai', null, 15),
  ('Pongal', 30, 60),
  ('Kal Dosai', null, 25),
  ('Plain Dosai', null, 50),
  ('Podi Dosai', null, 60),
  ('Masal Dosai', null, 60),
  ('Ghee Dosai', null, 70),
  ('Ghee Podi Dosai', null, 80),
  ('Sambar Idly', null, 70),
  ('Sambar Vadai', null, 25),
  ('Paneer Dosai', null, 100),
  ('Onion Dosai', null, 70),
  ('Onion Kal Dosai', null, 35),
  ('Butter Dosai', null, 70),
  ('Gobi Manchurian Dosai', null, 120),
  ('2 Poori', null, 40)
) as v(name, half_price, full_price);

-- Kitcha's Lunch (Mon-Sat) — daily items + day-special items.
-- Day-of-week gating for lunch is still done client-side by item name (see Menu.tsx),
-- not via menu_availability rows — carried over from the original project as a known
-- gap, not re-solved in this pass.
with cat as (select id from public.menu_categories where name = 'Kitcha''s Lunch')
insert into public.menu_items (category_id, name, half_price, full_price, kitchen_type, is_veg)
select cat.id, v.name, v.half_price, v.full_price, 'veg', true
from cat, (values
  ('Sambar Rice', 35::decimal, 70::decimal),
  ('Tamarind Rice', 35, 60),
  ('Lemon Rice', 35, 60),
  ('Tomato Rice', 35, 60),
  ('Curd Rice', 35, 60),
  ('Pepper Rice', 35, 60),
  ('Coconut Rice', 35, 60),
  ('Vegetable Biriyani', 35, 70),
  ('Vegetable Pulav', 35, 70),
  ('Carrot Rice', 35, 60),
  ('Masal Vadai', null, 15),
  ('Mint Rice', 35, 60),
  ('Rasam Rice', 35, 70)
) as v(name, half_price, full_price);

-- Kitcha's Dinner (Mon-Sat)
with cat as (select id from public.menu_categories where name = 'Kitcha''s Dinner')
insert into public.menu_items (category_id, name, half_price, full_price, kitchen_type, is_veg)
select cat.id, v.name, v.half_price, v.full_price, 'veg', true
from cat, (values
  ('Idly', null::decimal, 15::decimal),
  ('Kitchadi', null, 60),
  ('2 Chapathi', null, 40),
  ('2 Kal Dosai', null, 50),
  ('2 Parotta', null, 50),
  ('Plain Dosai', null, 50),
  ('Podi Dosai', null, 60),
  ('Ghee Dosai', null, 70),
  ('Ghee Podi Dosai', null, 80)
) as v(name, half_price, full_price);

-- Desserts — boarded as "Coming Soon": is_available = false, price 0, so they never
-- show on the public menu (the RLS policy only surfaces is_available = true items) and
-- nobody is accidentally charged ₹0. Flip is_available + set a real price once pricing
-- is decided — a data update, no code change needed.
with cat as (select id from public.menu_categories where name = 'Desserts')
insert into public.menu_items (category_id, name, full_price, kitchen_type, is_veg, is_available, description)
select cat.id, v.name, 0, 'veg', true, false, 'Coming soon'
from cat, (values
  ('Brownie'),
  ('Brownie with Ice Cream'),
  ('Cheesecake'),
  ('Blueberry Cake')
) as v(name);

-- KBR Breakfast
with cat as (select id from public.menu_categories where name = 'KBR Breakfast')
insert into public.menu_items (category_id, name, half_price, full_price, kitchen_type, is_veg)
select cat.id, v.name, v.half_price, v.full_price, 'nonveg', v.is_veg
from cat, (values
  ('Idly', null::decimal, 15::decimal, true),
  ('Pongal', 35, 60, true),
  ('2 Poori', null, 50, true),
  ('2 Dosai', null, 50, true),
  ('Vadai', null, 15, true),
  ('Boiled Egg', null, 15, false),
  ('Kozhi Curry Kolambu', null, 60, false)
) as v(name, half_price, full_price, is_veg);

-- KBR Brunch
with cat as (select id from public.menu_categories where name = 'KBR Brunch')
insert into public.menu_items (category_id, name, description, full_price, kitchen_type, is_veg)
select cat.id, v.name, v.description, v.full_price, 'nonveg', v.is_veg
from cat, (values
  ('Protein Shake', 'Various flavours available', 90::decimal, true),
  ('Veg Soup', 'Available Mon, Tue, Thu', 50, true),
  ('Chicken Soup', 'Available Wed, Fri', 70, false)
) as v(name, description, full_price, is_veg);

-- KBR Lunch (Mon-Fri) — common daily items + day-special items.
with cat as (select id from public.menu_categories where name = 'KBR Lunch')
insert into public.menu_items (category_id, name, half_price, full_price, kitchen_type, is_veg, description)
select cat.id, v.name, v.half_price, v.full_price, 'nonveg', v.is_veg, v.description
from cat, (values
  ('Boiled Egg', null::decimal, 15::decimal, false, null::text),
  ('Egg Thokku', null, 20, false, null),
  ('Egg Masala', null, 25, false, null),
  ('Veg Meals', null, 100, true, null),
  ('Non Veg Meals', null, 150, false, null),
  ('Chappathi (KBR)', null, 50, true, null),
  ('Sambar Rice (KBR)', 40, 70, true, null),
  ('Coconut Rice (KBR)', 40, 60, true, null),
  ('Tamarind Rice (KBR)', 40, 60, true, null),
  ('Pepper Chicken', null, 60, false, null),
  ('Carrot Rice (KBR)', 40, 60, true, null),
  ('Veg Pulav (KBR)', 40, 70, true, 'Available after 1:15 PM'),
  ('Chicken Fried Rice', null, 120, false, null),
  ('Chettinad Chicken', null, 60, false, null),
  ('Mint Rice (KBR)', 40, 60, true, null),
  ('Curd Rice (KBR)', 40, 60, true, null),
  ('Chicken Biriyani', null, 140, false, null),
  ('Rasam Rice (KBR)', 40, 70, true, null),
  ('Tomato Rice (KBR)', 40, 60, true, null),
  ('Gobi Fried Rice', null, 90, true, null),
  ('Pepper Rice (KBR)', 40, 60, true, null),
  ('Lemon Rice (KBR)', 40, 60, true, null),
  ('Boneless Chicken', null, 70, false, null),
  ('Mushroom Biriyani', null, 110, true, null)
) as v(name, half_price, full_price, is_veg, description);

-- KBR Evening Snacks (after 3:30 PM)
with cat as (select id from public.menu_categories where name = 'KBR Evening Snacks')
insert into public.menu_items (category_id, name, full_price, kitchen_type, is_veg, is_preorder_only)
select cat.id, v.name, v.full_price, 'nonveg', v.is_veg, v.is_preorder
from cat, (values
  ('Chicken Puff', 40::decimal, false, false),
  ('Paneer Puff', 40, true, false),
  ('Veg Roll', 40, true, false),
  ('Paneer Roll', 40, true, false),
  ('Veg Puff', 30, true, false),
  ('Egg Puff', 35, false, false),
  ('Chicken Shawarma', 90, false, true),
  ('Chicken Kebab', 120, false, true)
) as v(name, full_price, is_veg, is_preorder);
