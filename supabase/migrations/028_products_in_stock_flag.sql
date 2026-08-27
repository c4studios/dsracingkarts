-- Denormalised availability flag, so the shop can filter and sort by stock.
--
-- WHY A COLUMN. Two thirds of the live catalogue (5,466 of 8,423 sellable
-- products on 27 Aug 2026) render "Contact for ETA", and there is currently no
-- way to filter them out. This was verified against Square directly, not
-- inferred: a 400-item sample of products Supabase believes are out of stock
-- came back zero-for-zero from the Square Inventory API, so the data is
-- accurate rather than stale.
--
-- PostgREST cannot express the needed predicate any other way:
--   * an inner-join filter on the nested inventory works, but only covers
--     stock-managed products and cannot be OR'd with is_stockable = false
--   * `or=(is_stockable.is.false,product_variations.inventory.quantity.gt.0)`
--     returns 400; OR across an embedded resource is unsupported
--   * passing ~3,000 in-stock ids to .in() produces a ~114KB URL
--
-- Buyable means: a drop-ship item (is_stockable = false, always orderable), or
-- a stock-managed item with at least one variation holding a positive count.
-- This mirrors isUnavailableByStock() in src/lib/stock.ts exactly.
--
-- NOT YET APPLIED. Run in the Supabase SQL editor, then the shop filter can be
-- switched on.

alter table public.products
  add column if not exists in_stock boolean not null default false;

create index if not exists idx_products_in_stock
  on public.products (in_stock)
  where in_stock;

create or replace function public.recalc_product_in_stock(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products p
     set in_stock = (
       p.is_stockable is false
       or exists (
         select 1
           from public.product_variations v
           join public.inventory i on i.variation_id = v.id
          where v.product_id = p.id
            and coalesce(i.quantity, 0) > 0
       )
     )
   where p.id = p_product_id;
end;
$$;

create or replace function public.trg_recalc_in_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
begin
  if tg_table_name = 'inventory' then
    select v.product_id into v_product_id
      from public.product_variations v
     where v.id = coalesce(new.variation_id, old.variation_id);
  elsif tg_table_name = 'product_variations' then
    v_product_id := coalesce(new.product_id, old.product_id);
  else
    v_product_id := coalesce(new.id, old.id);
  end if;

  if v_product_id is not null then
    perform public.recalc_product_in_stock(v_product_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists inventory_in_stock on public.inventory;
create trigger inventory_in_stock
  after insert or update or delete on public.inventory
  for each row execute function public.trg_recalc_in_stock();

drop trigger if exists variations_in_stock on public.product_variations;
create trigger variations_in_stock
  after insert or update or delete on public.product_variations
  for each row execute function public.trg_recalc_in_stock();

-- Backfill every existing row.
update public.products p
   set in_stock = (
     p.is_stockable is false
     or exists (
       select 1
         from public.product_variations v
         join public.inventory i on i.variation_id = v.id
        where v.product_id = p.id
          and coalesce(i.quantity, 0) > 0
     )
   );
