-- Run once in the Supabase SQL editor. No visitor or logged-in Supabase user
-- can read these tables; only the Vercel server's service_role may access them.
begin;
create table if not exists public.rups_enquiries (
 id text primary key, name text not null, email text not null, clinic text not null,
 phone text not null, interest text not null, created_at bigint not null, verified_at bigint not null
);
create table if not exists public.rups_verifications (
 id text primary key, code_hash text not null, payload jsonb not null,
 expires_at bigint not null, attempts integer not null default 0
);
create table if not exists public.rups_admin (
 id integer primary key check(id=1), password_hash text not null, version integer not null default 1
);
create table if not exists public.rups_sessions (
 token_hash text primary key, expires_at bigint not null, version integer not null
);
create table if not exists public.rups_limits (
 key text primary key, count integer not null, expires_at bigint not null
);
alter table public.rups_enquiries enable row level security;
alter table public.rups_verifications enable row level security;
alter table public.rups_admin enable row level security;
alter table public.rups_sessions enable row level security;
alter table public.rups_limits enable row level security;
revoke all on public.rups_enquiries,public.rups_verifications,public.rups_admin,public.rups_sessions,public.rups_limits from public,anon,authenticated;
grant select,insert,update,delete on public.rups_enquiries,public.rups_verifications,public.rups_admin,public.rups_sessions,public.rups_limits to service_role;

create or replace function public.rups_rate(p_key text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n bigint := (extract(epoch from clock_timestamp())*1000)::bigint; c integer;
begin
 delete from public.rups_limits where expires_at<n;
 delete from public.rups_verifications where expires_at<n;
 delete from public.rups_sessions where expires_at<n;
 insert into public.rups_limits(key,count,expires_at) values(p_key,1,n+p_seconds*1000::bigint)
 on conflict(key) do update set count=public.rups_limits.count+1 returning count into c;
 return c<=p_limit;
end $$;

create or replace function public.rups_verify(p_id text,p_hash text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare row public.rups_verifications; n bigint := (extract(epoch from clock_timestamp())*1000)::bigint;
begin
 select * into row from public.rups_verifications where id=p_id for update;
 if not found or row.expires_at<n or row.attempts>=5 then return false; end if;
 if row.code_hash<>p_hash then
   update public.rups_verifications set attempts=attempts+1 where id=p_id;
   return false;
 end if;
 insert into public.rups_enquiries(id,name,email,clinic,phone,interest,created_at,verified_at)
 values(p_id,row.payload->>'name',row.payload->>'email',row.payload->>'clinic',row.payload->>'phone',row.payload->>'interest',n,n);
 delete from public.rups_verifications where id=p_id;
 return true;
end $$;

create or replace function public.rups_enquiry_count()
returns bigint language sql security invoker set search_path='' as $$ select count(*) from public.rups_enquiries; $$;

create or replace function public.rups_change_password(p_old text,p_new text)
returns integer language plpgsql security invoker set search_path='' as $$
declare v integer;
begin
 update public.rups_admin set password_hash=p_new,version=version+1 where id=1 and password_hash=p_old returning version into v;
 return v;
end $$;

revoke all on function public.rups_rate(text,integer,integer),public.rups_verify(text,text),public.rups_enquiry_count(),public.rups_change_password(text,text) from public,anon,authenticated;
grant execute on function public.rups_rate(text,integer,integer),public.rups_verify(text,text),public.rups_enquiry_count(),public.rups_change_password(text,text) to service_role;
commit;
