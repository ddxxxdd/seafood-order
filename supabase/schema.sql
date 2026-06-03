create table if not exists public.inventory (
  product_id text not null,
  spec_label text not null,
  initial_stock integer not null check (initial_stock >= 0),
  stock integer not null check (stock >= 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, spec_label)
);

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  order_id text not null unique,
  customer_name text not null,
  phone text not null,
  address text not null,
  delivery_date date not null,
  delivery_slot text not null,
  pay_method text not null,
  note text,
  items jsonb not null,
  totals jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

insert into public.inventory (product_id, spec_label, initial_stock, stock)
values
  ('shrimp', '500g', 36, 36),
  ('shrimp', '1kg', 22, 22),
  ('crab', '约700g', 12, 12),
  ('crab', '约1.2kg', 8, 8),
  ('seabass', '约600g', 28, 28),
  ('seabass', '约900g', 18, 18),
  ('salmon', '200g', 30, 30),
  ('salmon', '400g', 16, 16),
  ('scallop', '6只', 24, 24),
  ('scallop', '12只', 14, 14),
  ('clam', '500g', 42, 42),
  ('clam', '1kg', 26, 26)
on conflict (product_id, spec_label) do nothing;

insert into public.app_settings (key, value)
values ('admin_token', 'CHANGE_ME_BEFORE_DEPLOY')
on conflict (key) do nothing;

alter table public.inventory enable row level security;
alter table public.orders enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "Public can read inventory" on public.inventory;
create policy "Public can read inventory"
on public.inventory
for select
to anon
using (true);

create or replace function public.place_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_order_id text := coalesce(nullif(payload->>'order_id', ''), 'SX' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS') || lpad(floor(random() * 1000)::text, 3, '0'));
  item jsonb;
  item_product text;
  item_spec text;
  item_qty integer;
  row_stock integer;
  updated_inventory jsonb;
begin
  if payload is null or jsonb_typeof(payload->'items') <> 'array' or jsonb_array_length(payload->'items') = 0 then
    raise exception '订单商品不能为空';
  end if;

  for item in select value from jsonb_array_elements(payload->'items') loop
    item_product := item->>'product_id';
    item_spec := item->>'spec_label';
    item_qty := coalesce((item->>'qty')::integer, 0);

    if item_product is null or item_spec is null or item_qty <= 0 then
      raise exception '订单商品数据无效';
    end if;

    select stock
    into row_stock
    from public.inventory
    where product_id = item_product and spec_label = item_spec
    for update;

    if not found then
      raise exception '商品库存不存在：% %', item_product, item_spec;
    end if;

    if row_stock < item_qty then
      raise exception '% % 库存不足，剩余 %', item_product, item_spec, row_stock;
    end if;
  end loop;

  for item in select value from jsonb_array_elements(payload->'items') loop
    update public.inventory
    set stock = stock - (item->>'qty')::integer,
        updated_at = now()
    where product_id = item->>'product_id' and spec_label = item->>'spec_label';
  end loop;

  insert into public.orders (
    order_id,
    customer_name,
    phone,
    address,
    delivery_date,
    delivery_slot,
    pay_method,
    note,
    items,
    totals
  )
  values (
    new_order_id,
    payload->'customer'->>'name',
    payload->'customer'->>'phone',
    payload->'customer'->>'address',
    (payload->'delivery'->>'date')::date,
    payload->'delivery'->>'slot',
    payload->>'pay_method',
    payload->>'note',
    payload->'items',
    payload->'totals'
  );

  select jsonb_agg(
    jsonb_build_object(
      'product_id', product_id,
      'spec_label', spec_label,
      'stock', stock,
      'initial_stock', initial_stock
    )
    order by product_id, spec_label
  )
  into updated_inventory
  from public.inventory;

  return jsonb_build_object(
    'order_id', new_order_id,
    'inventory', coalesce(updated_inventory, '[]'::jsonb)
  );
end;
$$;

create or replace function public.reset_launch_data(admin_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_token text;
  updated_inventory jsonb;
begin
  select value into expected_token
  from public.app_settings
  where key = 'admin_token';

  if expected_token is null or expected_token = 'CHANGE_ME_BEFORE_DEPLOY' or admin_token is null or admin_token <> expected_token then
    raise exception '管理密钥无效';
  end if;

  delete from public.orders;

  update public.inventory
  set stock = initial_stock,
      updated_at = now();

  select jsonb_agg(
    jsonb_build_object(
      'product_id', product_id,
      'spec_label', spec_label,
      'stock', stock,
      'initial_stock', initial_stock
    )
    order by product_id, spec_label
  )
  into updated_inventory
  from public.inventory;

  return jsonb_build_object('inventory', coalesce(updated_inventory, '[]'::jsonb));
end;
$$;

grant usage on schema public to anon;
grant select on public.inventory to anon;
grant execute on function public.place_order(jsonb) to anon;
grant execute on function public.reset_launch_data(text) to anon;
