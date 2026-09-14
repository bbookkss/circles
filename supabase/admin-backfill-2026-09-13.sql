-- Backfill admins on circles created before createCircle set the role
-- ---------------------------------------------------------------------------
-- Five circles were created before `createCircle` began inserting the
-- creator's membership with role 'admin'. They have members but no admin, so
-- nobody can edit them or approve a join request. The circles are not broken
-- in any visible way, which is why this went unnoticed: the owner sees a
-- normal page and simply has no controls.
--
-- The rule is "earliest joined member becomes admin", which is the creator in
-- every case here because these circles have exactly one member each. Written
-- generally anyway so it stays correct if run later against a circle that has
-- since gained members.
--
-- Idempotent: circles that already have an admin are skipped by the NOT
-- EXISTS, so re-running promotes nobody and changes nothing.
-- ---------------------------------------------------------------------------

begin;

with orphaned as (
  select c.id as circle_id
    from public.circles c
   where not exists (
     select 1 from public.circle_members a
      where a.circle_id = c.id and a.role = 'admin'
   )
),
earliest as (
  select distinct on (cm.circle_id) cm.circle_id, cm.user_id
    from public.circle_members cm
    join orphaned o on o.circle_id = cm.circle_id
   order by cm.circle_id, cm.joined_at asc
)
update public.circle_members cm
   set role = 'admin'
  from earliest e
 where cm.circle_id = e.circle_id
   and cm.user_id   = e.user_id;

-- Every circle that has any member must now have at least one admin. If this
-- raises, something above is wrong and the transaction rolls back rather than
-- leaving the table half-corrected.
do $$
declare n int;
begin
  select count(*) into n
    from public.circles c
   where exists (select 1 from public.circle_members m where m.circle_id = c.id)
     and not exists (select 1 from public.circle_members a
                      where a.circle_id = c.id and a.role = 'admin');
  if n > 0 then
    raise exception 'still % circle(s) with members but no admin', n;
  end if;
end $$;

commit;
