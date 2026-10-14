-- Gap found while building the admin staff-management UI: public.profiles
-- only ever let a user see their OWN row ("Users can view their own profile",
-- auth.uid() = id, no staff/admin bypass — unlike menu_items, orders, etc.,
-- which all already use the public.is_staff() bypass pattern). That silently
-- blocked any admin/staff screen from resolving another user's name — orders
-- view, kitchen dashboard, and this staff-management screen all need it.
--
-- Mirrors the existing bypass pattern (e.g. "Users can view their own orders"
-- in 20261008000000_initial_schema.sql) rather than inventing a new one.
create policy "Staff can view all profiles"
  on public.profiles for select to authenticated
  using (public.is_staff(auth.uid()));
