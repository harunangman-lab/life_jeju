-- Run once in the Supabase SQL editor for your project.
-- No service_role key is used by the website. No AI services are involved.
begin;

create table if not exists public.jeju_books (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '' check (char_length(title)<=200),
  subtitle text not null default '' check (char_length(subtitle)<=300),
  author text not null default '' check (char_length(author)<=100),
  description text not null default '' check (char_length(description)<=4000),
  revision bigint not null default 1 check (revision>=1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,user_id)
);
create index if not exists jeju_books_owner_updated on public.jeju_books(user_id,updated_at desc);

create table if not exists public.jeju_book_manuscripts (
  book_id uuid primary key,
  user_id uuid not null,
  document jsonb not null check (jsonb_typeof(document)='object' and octet_length(document::text)<=20971520),
  updated_at timestamptz not null default now(),
  foreign key(book_id,user_id) references public.jeju_books(id,user_id) on delete cascade
);
create index if not exists jeju_manuscripts_owner on public.jeju_book_manuscripts(user_id);

alter table public.jeju_books enable row level security;
alter table public.jeju_book_manuscripts enable row level security;
revoke all on public.jeju_books,public.jeju_book_manuscripts from anon,authenticated;
grant select,insert,update,delete on public.jeju_books,public.jeju_book_manuscripts to authenticated;

drop policy if exists jeju_books_select_own on public.jeju_books;
drop policy if exists jeju_books_insert_own on public.jeju_books;
drop policy if exists jeju_books_update_own on public.jeju_books;
drop policy if exists jeju_books_delete_own on public.jeju_books;
create policy jeju_books_select_own on public.jeju_books for select to authenticated using ((select auth.uid())=user_id);
create policy jeju_books_insert_own on public.jeju_books for insert to authenticated with check ((select auth.uid())=user_id);
create policy jeju_books_update_own on public.jeju_books for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy jeju_books_delete_own on public.jeju_books for delete to authenticated using ((select auth.uid())=user_id);

drop policy if exists jeju_manuscripts_select_own on public.jeju_book_manuscripts;
drop policy if exists jeju_manuscripts_insert_own on public.jeju_book_manuscripts;
drop policy if exists jeju_manuscripts_update_own on public.jeju_book_manuscripts;
drop policy if exists jeju_manuscripts_delete_own on public.jeju_book_manuscripts;
create policy jeju_manuscripts_select_own on public.jeju_book_manuscripts for select to authenticated using ((select auth.uid())=user_id);
create policy jeju_manuscripts_insert_own on public.jeju_book_manuscripts for insert to authenticated with check ((select auth.uid())=user_id);
create policy jeju_manuscripts_update_own on public.jeju_book_manuscripts for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy jeju_manuscripts_delete_own on public.jeju_book_manuscripts for delete to authenticated using ((select auth.uid())=user_id);

create or replace function public.valid_jeju_book_document(p_document jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare s jsonb; a jsonb; tag jsonb; ids text[]:='{}'; n integer:=0; total integer:=0; sections integer;
begin
  if p_document is null or pg_catalog.octet_length(p_document::text)>20971520
     or pg_catalog.jsonb_typeof(p_document)<>'object' or p_document->'version' is distinct from '1'::jsonb
     or pg_catalog.jsonb_typeof(p_document->'sections') is distinct from 'array' then return false; end if;
  sections:=pg_catalog.jsonb_array_length(p_document->'sections');
  if sections<3 or sections>102 then return false; end if;
  for s in select value from pg_catalog.jsonb_array_elements(p_document->'sections') loop
    n:=n+1;
    if pg_catalog.jsonb_typeof(s->'id') is distinct from 'string' or not (s->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
       or s->>'id'=any(ids) or pg_catalog.jsonb_typeof(s->'title') is distinct from 'string' or pg_catalog.char_length(s->>'title')>200
       or pg_catalog.jsonb_typeof(s->'body') is distinct from 'string' or pg_catalog.char_length(s->>'body')>100000
       or pg_catalog.jsonb_typeof(s->'articles') is distinct from 'array' then return false; end if;
    if (n=1 and s->>'kind' is distinct from 'intro') or (n=sections and s->>'kind' is distinct from 'outro')
       or (n>1 and n<sections and s->>'kind' is distinct from 'chapter') then return false; end if;
    ids:=pg_catalog.array_append(ids,s->>'id');
    for a in select value from pg_catalog.jsonb_array_elements(s->'articles') loop
      total:=total+1;
      if total>1000 or pg_catalog.jsonb_typeof(a->'id') is distinct from 'string'
         or not (a->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') or a->>'id'=any(ids)
         or pg_catalog.jsonb_typeof(a->'title') is distinct from 'string' or pg_catalog.char_length(a->>'title')>200
         or pg_catalog.jsonb_typeof(a->'body') is distinct from 'string' or pg_catalog.char_length(a->>'body')>100000
         or pg_catalog.jsonb_typeof(a->'sourceId') is distinct from 'string' or pg_catalog.char_length(a->>'sourceId')>200
         or pg_catalog.jsonb_typeof(a->'sourceDate') is distinct from 'string' or pg_catalog.char_length(a->>'sourceDate')>200
         or pg_catalog.jsonb_typeof(a->'sourceType') is distinct from 'string' or pg_catalog.char_length(a->>'sourceType')>20
         or pg_catalog.jsonb_typeof(a->'place') is distinct from 'string' or pg_catalog.char_length(a->>'place')>200
         or pg_catalog.jsonb_typeof(a->'tags') is distinct from 'array' then return false; end if;
      if pg_catalog.jsonb_array_length(a->'tags')>20 then return false; end if;
      for tag in select value from pg_catalog.jsonb_array_elements(a->'tags') loop
        if pg_catalog.jsonb_typeof(tag)<>'string' or pg_catalog.char_length(tag#>>'{}')>40 then return false; end if;
      end loop;
      if a ? 'photoData' and a->'photoData'<>'null'::jsonb then
        if pg_catalog.jsonb_typeof(a->'photoData')<>'string' or pg_catalog.char_length(a->>'photoData')>800000
           or not (a->>'photoData' ~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/]*={0,2}$') then return false; end if;
      end if;
      ids:=pg_catalog.array_append(ids,a->>'id');
    end loop;
  end loop;
  return true;
end;
$$;

create or replace function public.save_jeju_book(p_book_id uuid,p_expected_revision bigint,p_metadata jsonb,p_document jsonb)
returns bigint language plpgsql security invoker set search_path='' as $$
declare owner uuid:=auth.uid(); current_revision bigint; new_revision bigint;
begin
  if owner is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_book_id is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'INVALID_BOOK'; end if;
  if p_metadata is null or pg_catalog.jsonb_typeof(p_metadata)<>'object'
     or pg_catalog.jsonb_typeof(p_metadata->'title') is distinct from 'string' or pg_catalog.char_length(p_metadata->>'title')>200
     or pg_catalog.jsonb_typeof(p_metadata->'subtitle') is distinct from 'string' or pg_catalog.char_length(p_metadata->>'subtitle')>300
     or pg_catalog.jsonb_typeof(p_metadata->'author') is distinct from 'string' or pg_catalog.char_length(p_metadata->>'author')>100
     or pg_catalog.jsonb_typeof(p_metadata->'description') is distinct from 'string' or pg_catalog.char_length(p_metadata->>'description')>4000
     or not public.valid_jeju_book_document(p_document) then raise exception 'INVALID_MANUSCRIPT'; end if;
  -- Serialize creation as well as updates. Metadata + manuscript commit atomically.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner::text||':'||p_book_id::text,0));
  select revision into current_revision from public.jeju_books where id=p_book_id and user_id=owner for update;
  if not found then
    if p_expected_revision<>0 then raise exception 'BOOK_CONFLICT'; end if;
    new_revision:=1;
    insert into public.jeju_books(id,user_id,title,subtitle,author,description,revision)
      values(p_book_id,owner,p_metadata->>'title',p_metadata->>'subtitle',p_metadata->>'author',p_metadata->>'description',new_revision);
    insert into public.jeju_book_manuscripts(book_id,user_id,document) values(p_book_id,owner,p_document);
  else
    if current_revision<>p_expected_revision then raise exception 'BOOK_CONFLICT'; end if;
    new_revision:=current_revision+1;
    update public.jeju_books set title=p_metadata->>'title',subtitle=p_metadata->>'subtitle',author=p_metadata->>'author',description=p_metadata->>'description',revision=new_revision,updated_at=pg_catalog.now() where id=p_book_id and user_id=owner;
    update public.jeju_book_manuscripts set document=p_document,updated_at=pg_catalog.now() where book_id=p_book_id and user_id=owner;
    if not found then raise exception 'MANUSCRIPT_MISSING'; end if;
  end if;
  return new_revision;
end;
$$;
revoke all on function public.valid_jeju_book_document(jsonb) from public,anon;
revoke all on function public.save_jeju_book(uuid,bigint,jsonb,jsonb) from public,anon;
grant execute on function public.valid_jeju_book_document(jsonb) to authenticated;
grant execute on function public.save_jeju_book(uuid,bigint,jsonb,jsonb) to authenticated;
commit;
