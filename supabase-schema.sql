-- ============================================================
-- LA CUENTA DE MESA DE GALANES — Supabase schema
-- Ejecutar en SQL Editor de Supabase (Settings > SQL Editor)
-- ============================================================

-- 1. Extension UUID
create extension if not exists "uuid-ossp";

-- 2. Tablas --------------------------------------------------

create table members (
  id         uuid default uuid_generate_v4() primary key,
  name       text not null,
  is_default boolean default true,
  created_at timestamptz default now()
);

create table events (
  id         uuid default uuid_generate_v4() primary key,
  date       date default current_date,
  status     text default 'open' check (status in ('open','closed')),
  created_at timestamptz default now()
);

create table event_attendees (
  id         uuid default uuid_generate_v4() primary key,
  event_id   uuid references events(id) on delete cascade not null,
  member_id  uuid references members(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(event_id, member_id)
);

create table event_expenses (
  id          uuid default uuid_generate_v4() primary key,
  event_id    uuid references events(id) on delete cascade not null,
  member_id   uuid references members(id) on delete cascade not null,
  amount      decimal(12,2) not null default 0,
  description text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(event_id, member_id)
);

-- 3. Seed integrantes fijos ----------------------------------

insert into members (name) values
  ('Martin'),
  ('Martin Colores'),
  ('Sergio'),
  ('Horacio'),
  ('Nestor'),
  ('Dieguito'),
  ('Javi L'),
  ('Flaco Javier'),
  ('Leandro'),
  ('Walter'),
  ('Mariano'),
  ('Suja'),
  ('Landen'),
  ('Ariel');

-- 4. RLS (acceso público, sin auth) -------------------------

alter table members          enable row level security;
alter table events           enable row level security;
alter table event_attendees  enable row level security;
alter table event_expenses   enable row level security;

create policy "public_members"     on members          for all using (true) with check (true);
create policy "public_events"      on events           for all using (true) with check (true);
create policy "public_attendees"   on event_attendees  for all using (true) with check (true);
create policy "public_expenses"    on event_expenses   for all using (true) with check (true);

-- 5. Replica identity full (para que DELETE en realtime
--    devuelva el registro completo, incluido member_id)

alter table event_attendees replica identity full;
alter table event_expenses  replica identity full;

-- 6. Habilitar Realtime en las tablas -----------------------

alter publication supabase_realtime add table event_attendees;
alter publication supabase_realtime add table event_expenses;
alter publication supabase_realtime add table members;

-- 7. Función auto-update para updated_at --------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_expenses_updated_at
  before update on event_expenses
  for each row execute function set_updated_at();
