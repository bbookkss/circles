-- ---------------------------------------------------------------------------
-- Trivia gets its own category. 2026-11-18
--
-- The nine pub trivia circles from sf-trivia-2026-11-18.sql were filed under
-- Social. Trivia is now a category in its own right (src/lib/categories.ts),
-- so it has its own filter chip in Explore. Category is free text with no
-- constraint, so this is only a data move.
-- ---------------------------------------------------------------------------
begin;

update public.circles
   set category = 'Trivia'
 where created_by = '45d90d0c-7f6f-48fe-ac83-66fb49a2b4a3'
   and name like 'Trivia at %'
   and category = 'Social';

do $$
begin
  if (select count(*) from public.circles where name like 'Trivia at %' and category = 'Trivia') < 9 then
    raise exception 'post-condition: expected nine trivia circles in Trivia';
  end if;
end $$;

commit;
