delete from public.orders;

update public.inventory
set stock = initial_stock,
    updated_at = now();
