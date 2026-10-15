-- The inventory UI records stock movements (received a delivery, used up
-- stock, corrected a count) rather than letting someone directly overwrite
-- inventory_items.current_quantity — that would leave no audit trail and
-- inventory_transactions would just sit there unused even though the
-- original schema clearly intended it to be the record of what happened.
--
-- This function makes "log the transaction" + "update the running total"
-- a single atomic unit (unlike Checkout's two sequential inserts, which are
-- a documented, accepted limitation elsewhere in this project — inventory
-- correctness matters enough to not repeat that pattern here).
--
-- security invoker (the default, stated explicitly): runs as the calling
-- user, so the existing RLS policies on both tables still apply — this
-- function grants no extra privilege, it just makes two writes atomic.
create or replace function public.record_inventory_transaction(
  p_inventory_item_id uuid,
  p_transaction_type text,
  p_quantity numeric,
  p_notes text default null,
  p_reference_order_id uuid default null
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_transaction_type not in ('in', 'out') then
    raise exception 'transaction_type must be ''in'' or ''out''';
  end if;
  if p_quantity <= 0 then
    raise exception 'quantity must be positive';
  end if;

  insert into public.inventory_transactions
    (inventory_item_id, transaction_type, quantity, reference_order_id, notes, created_by)
  values
    (p_inventory_item_id, p_transaction_type, p_quantity, p_reference_order_id, p_notes, auth.uid());

  if p_transaction_type = 'in' then
    update public.inventory_items
      set current_quantity = current_quantity + p_quantity, updated_at = now()
      where id = p_inventory_item_id;
  else
    update public.inventory_items
      set current_quantity = current_quantity - p_quantity, updated_at = now()
      where id = p_inventory_item_id;
  end if;
end;
$$;

grant execute on function public.record_inventory_transaction(uuid, text, numeric, text, uuid) to authenticated;
