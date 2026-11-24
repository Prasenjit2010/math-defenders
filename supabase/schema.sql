-- Math Defenders: classes and student progress for Supabase (Postgres).
-- Students are identified only by a nickname inside a class code. No emails,
-- no real names, no accounts. Run this once in the Supabase SQL Editor.
--
-- Security model: both tables have Row Level Security turned on with no
-- policies, so the public (anon) key cannot read or write them directly.
-- The game only calls the functions below, which validate every input,
-- and teacher-only functions check the class PIN (stored as a bcrypt hash).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.md_classes (
  code            text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  pin_hash        text not null,
  failed_attempts int  not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.md_players (
  id           uuid primary key default gen_random_uuid(),
  class_code   text not null references public.md_classes(code) on delete cascade,
  nickname     text not null check (char_length(nickname) between 1 and 18),
  nickname_key text not null,
  elo          int  not null default 1000 check (elo between 0 and 5000),
  best_wave    int  not null default 0 check (best_wave between 0 and 100),
  answered     int  not null default 0 check (answered >= 0),
  correct      int  not null default 0 check (correct >= 0),
  best_streak  int  not null default 0 check (best_streak >= 0),
  games        int  not null default 0 check (games >= 0),
  topics       jsonb not null default '{}'::jsonb,
  weak         jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (class_code, nickname_key)
);
create index if not exists md_players_class_idx on public.md_players (class_code);

alter table public.md_classes enable row level security;
alter table public.md_players enable row level security;
revoke all on public.md_classes from anon, authenticated;
revoke all on public.md_players from anon, authenticated;

-- Teacher PIN check with lockout: 10 wrong PINs locks the class for 15 minutes.
-- Callers return an error value on a wrong PIN instead of raising, so the failed-attempt count is kept.
create or replace function public.md_pin_ok(p_code text, p_pin text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare c public.md_classes;
begin
  select * into c from public.md_classes where code = upper(trim(p_code)) for update;
  if not found then return false; end if;
  if c.locked_until is not null and c.locked_until > now() then
    raise exception 'Too many wrong PINs. Try again in a few minutes.';
  end if;
  if coalesce(p_pin, '') ~ '^\d{4,6}$' and extensions.crypt(p_pin, c.pin_hash) = c.pin_hash then
    update public.md_classes set failed_attempts = 0, locked_until = null where code = c.code;
    return true;
  end if;
  update public.md_classes
     set failed_attempts = c.failed_attempts + 1,
         locked_until = case when c.failed_attempts + 1 >= 10 then now() + interval '15 minutes' else null end
   where code = c.code;
  return false;
end $$;

create or replace function public.md_create_class(p_pin text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_code text;
  chars  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i      int;
begin
  if coalesce(p_pin, '') !~ '^\d{4,6}$' then raise exception 'PIN must be 4 to 6 digits'; end if;
  if (select count(*) from public.md_classes where created_at > now() - interval '1 minute') >= 60 then
    raise exception 'Lots of classes are being made right now. Try again in a minute.';
  end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.md_classes where code = v_code);
  end loop;
  insert into public.md_classes (code, pin_hash) values (v_code, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)));
  return v_code;
end $$;

-- Student joins (or returns to) a class with a nickname. Returns null if the class code doesn't exist.
create or replace function public.md_join(p_code text, p_nickname text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_nick text := regexp_replace(trim(coalesce(p_nickname, '')), '\s+', ' ', 'g');
  p      public.md_players;
begin
  if not exists (select 1 from public.md_classes where code = v_code) then return null; end if;
  if char_length(v_nick) < 1 or char_length(v_nick) > 18 then raise exception 'Nickname must be 1 to 18 characters'; end if;
  select * into p from public.md_players where class_code = v_code and nickname_key = lower(v_nick);
  if not found then
    if (select count(*) from public.md_players where class_code = v_code) >= 200 then
      raise exception 'This class is full (200 students).';
    end if;
    insert into public.md_players (class_code, nickname, nickname_key)
    values (v_code, v_nick, lower(v_nick))
    on conflict (class_code, nickname_key) do nothing;
    select * into p from public.md_players where class_code = v_code and nickname_key = lower(v_nick);
  end if;
  return json_build_object('id', p.id, 'nickname', p.nickname, 'elo', p.elo, 'best_wave', p.best_wave,
    'answered', p.answered, 'correct', p.correct, 'best_streak', p.best_streak, 'games', p.games, 'returning', p.games > 0 or p.answered > 0);
end $$;

-- Save progress. answered/correct/games and topic counts are amounts to ADD (since the last save);
-- elo, best_wave and best_streak are current values. Everything is clamped to sane ranges.
create or replace function public.md_save(
  p_id uuid, p_code text, p_elo int, p_best_wave int, p_answered int, p_correct int,
  p_best_streak int, p_games int, p_topics jsonb, p_weak jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  p        public.md_players;
  v_topics jsonb;
  k        text;
  val      jsonb;
  a        int;
  c        int;
  d_ans    int := least(greatest(coalesce(p_answered, 0), 0), 2000);
  d_cor    int;
begin
  select * into p from public.md_players where id = p_id and class_code = upper(trim(coalesce(p_code, ''))) for update;
  if not found then return false; end if;
  d_cor := least(greatest(coalesce(p_correct, 0), 0), d_ans);
  v_topics := p.topics;
  if jsonb_typeof(p_topics) = 'object' then
    for k, val in select * from jsonb_each(p_topics) loop
      continue when k !~ '^[a-z0-9]{2,12}$' or jsonb_typeof(val) <> 'object';
      a := least(greatest(coalesce((val ->> 'a')::int, 0), 0), 2000);
      c := least(greatest(coalesce((val ->> 'c')::int, 0), 0), a);
      v_topics := jsonb_set(v_topics, array[k], jsonb_build_object(
        'a', coalesce((v_topics -> k ->> 'a')::int, 0) + a,
        'c', coalesce((v_topics -> k ->> 'c')::int, 0) + c), true);
    end loop;
  end if;
  update public.md_players set
    elo         = least(greatest(coalesce(p_elo, p.elo), p.elo - 400, 0), p.elo + 400, 5000),
    best_wave   = greatest(p.best_wave, least(greatest(coalesce(p_best_wave, 0), 0), 100)),
    answered    = p.answered + d_ans,
    correct     = p.correct + d_cor,
    best_streak = greatest(p.best_streak, least(greatest(coalesce(p_best_streak, 0), 0), 10000)),
    games       = p.games + least(greatest(coalesce(p_games, 0), 0), 5),
    topics      = v_topics,
    weak        = case when jsonb_typeof(p_weak) = 'array' and pg_column_size(p_weak) < 6000 then p_weak else p.weak end,
    updated_at  = now()
  where id = p.id;
  return true;
end $$;

create or replace function public.md_report(p_code text, p_pin text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.md_pin_ok(p_code, p_pin) then return json_build_object('error', 'bad_pin'); end if;
  return coalesce((
    select json_agg(json_build_object('id', id, 'nickname', nickname, 'elo', elo, 'best_wave', best_wave,
      'answered', answered, 'correct', correct, 'best_streak', best_streak, 'games', games,
      'topics', topics, 'weak', weak, 'updated_at', updated_at) order by nickname_key)
    from public.md_players where class_code = upper(trim(p_code))), '[]'::json);
end $$;

create or replace function public.md_remove_player(p_code text, p_pin text, p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.md_pin_ok(p_code, p_pin) then return false; end if;
  delete from public.md_players where id = p_id and class_code = upper(trim(p_code));
  return found;
end $$;

-- Only the game functions are callable with the public key.
revoke all on function public.md_pin_ok(text, text) from public, anon, authenticated;
grant execute on function public.md_create_class(text) to anon, authenticated;
grant execute on function public.md_join(text, text) to anon, authenticated;
grant execute on function public.md_save(uuid, text, int, int, int, int, int, int, jsonb, jsonb) to anon, authenticated;
grant execute on function public.md_report(text, text) to anon, authenticated;
grant execute on function public.md_remove_player(text, text, uuid) to anon, authenticated;
