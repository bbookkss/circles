-- Messaging: following someone is enough
-- ---------------------------------------------------------------------------
-- The INSERT policy on messages required a mutual follow. Pilot users hit it
-- on day one: they followed someone, went looking for a way to message them,
-- and found nothing, with no explanation of why. The rule was invisible and
-- the product did not say it out loud anywhere a person would look first.
--
-- New rule: you can message anyone you follow. Reading is unchanged (sender
-- or recipient only). The app's canMessage checks and its copy now match.
--
-- What this trades away, on purpose: a stranger can follow you and then
-- message you. That is how every consumer app people already use behaves,
-- and the mitigation is a block, which does not exist yet and is tracked in
-- PRODUCTION.md. Until it does, an unwanted thread can simply be ignored.
--
-- Run in the dashboard SQL editor.
-- ---------------------------------------------------------------------------

begin;

drop policy if exists "messages: insert if mutual follow" on public.messages;

create policy "messages: insert if following" on public.messages
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and sender_id <> recipient_id
    and exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.following_id = recipient_id
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages'
      and policyname = 'messages: insert if following'
  ) then
    raise exception 'messages insert policy missing';
  end if;
end $$;

commit;
