create extension if not exists pgcrypto;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  account_type text not null
    check (account_type in ('Assets', 'Liabilities', 'Equity', 'Revenue', 'Expenses')),
  normal_balance text not null check (normal_balance in ('debit', 'credit')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_number text not null unique,
  entry_date date not null,
  description text not null check (length(btrim(description)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null
    references public.journal_entries(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  account_id uuid not null references public.accounts(id),
  debit numeric(14, 2) not null default 0 check (debit >= 0),
  credit numeric(14, 2) not null default 0 check (credit >= 0),
  created_at timestamptz not null default now(),
  constraint journal_lines_one_side check ((debit > 0) <> (credit > 0)),
  constraint journal_lines_unique_number unique (journal_entry_id, line_number)
);

create index if not exists journal_lines_account_id_idx
  on public.journal_lines(account_id);

alter table public.accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

drop policy if exists "Public can read accounts" on public.accounts;
create policy "Public can read accounts"
  on public.accounts for select to anon, authenticated using (true);

drop policy if exists "Public can read journal entries" on public.journal_entries;
create policy "Public can read journal entries"
  on public.journal_entries for select to anon, authenticated using (true);

drop policy if exists "Public can read journal lines" on public.journal_lines;
create policy "Public can read journal lines"
  on public.journal_lines for select to anon, authenticated using (true);

grant usage on schema public to anon, authenticated;
grant select on public.accounts, public.journal_entries, public.journal_lines
  to anon, authenticated;

create or replace function public.post_journal_entry(
  p_entry_date date,
  p_description text,
  p_lines jsonb
)
returns table (
  id uuid,
  entry_number text,
  entry_date date,
  description text
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_entry_id uuid;
  v_entry_number text;
  v_line_count integer;
  v_debits numeric;
  v_credits numeric;
begin
  if p_entry_date is null or p_description is null or length(btrim(p_description)) = 0 then
    raise exception 'Entry date and description are required.' using errcode = '22023';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) < 2 then
    raise exception 'An entry must contain at least two journal lines.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) as item(line)
    where jsonb_typeof(item.line) <> 'object'
       or not (item.line ? 'account_id')
       or coalesce((item.line->>'debit')::numeric, 0) < 0
       or coalesce((item.line->>'credit')::numeric, 0) < 0
       or coalesce((item.line->>'debit')::numeric, 0)
            = coalesce((item.line->>'credit')::numeric, 0)
       or coalesce((item.line->>'debit')::numeric, 0)
            <> round(coalesce((item.line->>'debit')::numeric, 0), 2)
       or coalesce((item.line->>'credit')::numeric, 0)
            <> round(coalesce((item.line->>'credit')::numeric, 0), 2)
  ) then
    raise exception 'Each journal line needs an account and exactly one positive amount to two decimals.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) as item(line)
    left join public.accounts as account
      on account.id = (item.line->>'account_id')::uuid
    where account.id is null or not account.is_active
  ) then
    raise exception 'Every journal line must use an active account.' using errcode = '22023';
  end if;

  select
    count(*)::integer,
    coalesce(sum(coalesce((item.line->>'debit')::numeric, 0)), 0),
    coalesce(sum(coalesce((item.line->>'credit')::numeric, 0)), 0)
  into v_line_count, v_debits, v_credits
  from jsonb_array_elements(p_lines) as item(line);

  if v_line_count < 2 or round(v_debits, 2) = 0
     or round(v_debits, 2) <> round(v_credits, 2) then
    raise exception 'Entry not posted: total debits must equal total credits.'
      using errcode = '22023';
  end if;

  v_entry_number :=
    'JE-' || to_char(p_entry_date, 'YYYY') || '-' ||
    upper(substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.journal_entries (entry_number, entry_date, description)
  values (v_entry_number, p_entry_date, btrim(p_description))
  returning journal_entries.id into v_entry_id;

  insert into public.journal_lines (
    journal_entry_id, line_number, account_id, debit, credit
  )
  select
    v_entry_id,
    item.ordinality::integer,
    (item.line->>'account_id')::uuid,
    coalesce((item.line->>'debit')::numeric, 0),
    coalesce((item.line->>'credit')::numeric, 0)
  from jsonb_array_elements(p_lines) with ordinality as item(line, ordinality);

  return query
    select entry.id, entry.entry_number, entry.entry_date, entry.description
    from public.journal_entries as entry
    where entry.id = v_entry_id;
end;
$$;

revoke all on function public.post_journal_entry(date, text, jsonb) from public;
grant execute on function public.post_journal_entry(date, text, jsonb)
  to anon, authenticated;

insert into public.accounts (code, name, account_type, normal_balance)
values
  ('1000', 'Cash and bank', 'Assets', 'debit'),
  ('1100', 'Accounts receivable', 'Assets', 'debit'),
  ('1200', 'Office equipment', 'Assets', 'debit'),
  ('1300', 'Accumulated depreciation', 'Assets', 'credit'),
  ('2000', 'Accounts payable', 'Liabilities', 'credit'),
  ('2100', 'VAT payable', 'Liabilities', 'credit'),
  ('3000', 'Owner capital', 'Equity', 'credit'),
  ('3100', 'Retained earnings', 'Equity', 'credit'),
  ('4000', 'Consulting revenue', 'Revenue', 'credit'),
  ('4100', 'Other income', 'Revenue', 'credit'),
  ('5000', 'Rent expense', 'Expenses', 'debit'),
  ('5100', 'Supplies expense', 'Expenses', 'debit'),
  ('5200', 'Utilities expense', 'Expenses', 'debit'),
  ('5300', 'Salaries expense', 'Expenses', 'debit')
on conflict (code) do update set
  name = excluded.name,
  account_type = excluded.account_type,
  normal_balance = excluded.normal_balance,
  is_active = true;

insert into public.journal_entries (entry_number, entry_date, description)
values
  ('JE-2025-001', '2025-11-01', 'Owner investment'),
  ('JE-2025-002', '2025-11-02', 'November office rent'),
  ('JE-2025-003', '2025-11-03', 'Consulting services — paid'),
  ('JE-2025-004', '2025-11-04', 'Laptop and office equipment'),
  ('JE-2025-005', '2025-11-05', 'Office supplies on account'),
  ('JE-2025-006', '2025-11-06', 'Consulting invoice issued'),
  ('JE-2025-007', '2025-11-07', 'Electricity and internet'),
  ('JE-2025-008', '2025-11-08', 'Customer invoice payment'),
  ('JE-2025-009', '2025-11-09', 'Office supplies invoice paid'),
  ('JE-2025-010', '2025-11-10', 'November payroll')
on conflict (entry_number) do nothing;

with seed_lines(entry_number, line_number, account_code, debit, credit) as (
  values
    ('JE-2025-001', 1, '1000', 100000.00, 0.00),
    ('JE-2025-001', 2, '3000', 0.00, 100000.00),
    ('JE-2025-002', 1, '5000', 8000.00, 0.00),
    ('JE-2025-002', 2, '1000', 0.00, 8000.00),
    ('JE-2025-003', 1, '1000', 15000.00, 0.00),
    ('JE-2025-003', 2, '4000', 0.00, 15000.00),
    ('JE-2025-004', 1, '1200', 24000.00, 0.00),
    ('JE-2025-004', 2, '1000', 0.00, 24000.00),
    ('JE-2025-005', 1, '5100', 3200.00, 0.00),
    ('JE-2025-005', 2, '2000', 0.00, 3200.00),
    ('JE-2025-006', 1, '1100', 12500.00, 0.00),
    ('JE-2025-006', 2, '4000', 0.00, 12500.00),
    ('JE-2025-007', 1, '5200', 950.00, 0.00),
    ('JE-2025-007', 2, '1000', 0.00, 950.00),
    ('JE-2025-008', 1, '1000', 12500.00, 0.00),
    ('JE-2025-008', 2, '1100', 0.00, 12500.00),
    ('JE-2025-009', 1, '2000', 3200.00, 0.00),
    ('JE-2025-009', 2, '1000', 0.00, 3200.00),
    ('JE-2025-010', 1, '5300', 18000.00, 0.00),
    ('JE-2025-010', 2, '1000', 0.00, 18000.00)
)
insert into public.journal_lines (
  journal_entry_id, line_number, account_id, debit, credit
)
select
  entry.id,
  seed.line_number,
  account.id,
  seed.debit,
  seed.credit
from seed_lines as seed
join public.journal_entries as entry on entry.entry_number = seed.entry_number
join public.accounts as account on account.code = seed.account_code
on conflict (journal_entry_id, line_number) do nothing;
