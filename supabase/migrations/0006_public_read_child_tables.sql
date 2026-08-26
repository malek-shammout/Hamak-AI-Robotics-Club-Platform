-- =====================================================================================
--  HMK Platform — Migration 0006
--  Child tables inherit their parent's publicity
-- =====================================================================================
--  FOUND BY: querying pg_policies before writing the public project page, after the
--  0004 lesson that "the parent is readable" does not mean the page renders.
--
--  THE GAP
--    schema.sql granted anon SELECT on the published PARENTS (projects, events,
--    articles, galleries, awards) but not on their child/join tables. A published
--    project page would therefore render with no technologies, no team and no images —
--    silently, exactly like the ClubMap bug in 0004.
--
--  THE PRINCIPLE
--    A child row is visible IFF its parent is published. Never `using (true)` on a
--    join table: that leaks rows belonging to unpublished drafts.
--
--  DELIBERATELY EXCLUDED
--    `project_bom_lines`. A bill of materials exposes hardware holdings and unit costs.
--    It stays staff-only (M7.READ). Do not add it here "for completeness".
-- =====================================================================================

set search_path = public, extensions, pg_catalog;

begin;

create policy "public_read_published_project_tech" on public.project_technologies
  for select to anon, authenticated
  using (exists (select 1 from public.projects p
                  where p.id = project_technologies.project_id
                    and p.publication_status = 'PUBLISHED'));

create policy "public_read_published_project_media" on public.project_media
  for select to anon, authenticated
  using (visibility = 'PUBLIC'
         and exists (select 1 from public.projects p
                      where p.id = project_media.project_id
                        and p.publication_status = 'PUBLISHED'));

create policy "public_read_published_project_members" on public.project_members
  for select to anon, authenticated
  using (exists (select 1 from public.projects p
                  where p.id = project_members.project_id
                    and p.publication_status = 'PUBLISHED'));

create policy "public_read_published_event_sessions" on public.event_sessions
  for select to anon, authenticated
  using (exists (select 1 from public.events e
                  where e.id = event_sessions.event_id
                    and e.publication_status = 'PUBLISHED'));

create policy "public_read_published_article_tags" on public.article_tags
  for select to anon, authenticated
  using (exists (select 1 from public.articles a
                  where a.id = article_tags.article_id
                    and a.publication_status = 'PUBLISHED'));

create policy "public_read_published_gallery_items" on public.gallery_items
  for select to anon, authenticated
  using (exists (select 1 from public.galleries g
                  where g.id = gallery_items.gallery_id
                    and g.publication_status = 'PUBLISHED'));

create policy "public_read_published_award_recipients" on public.award_recipients
  for select to anon, authenticated
  using (exists (select 1 from public.awards a
                  where a.id = award_recipients.award_id
                    and a.publication_status = 'PUBLISHED'));

-- media_assets referenced by published content must be readable or every cover 404s.
-- Scoped to assets actually reachable from a published parent, not the whole library.
create policy "public_read_published_media_assets" on public.media_assets
  for select to anon, authenticated
  using (
    exists (select 1 from public.projects p
             where p.cover_media_id = media_assets.id and p.publication_status = 'PUBLISHED')
    or exists (select 1 from public.articles a
                where a.cover_media_id = media_assets.id and a.publication_status = 'PUBLISHED')
    or exists (select 1 from public.project_media pm
                join public.projects p on p.id = pm.project_id
               where pm.media_asset_id = media_assets.id
                 and pm.visibility = 'PUBLIC' and p.publication_status = 'PUBLISHED')
    or exists (select 1 from public.gallery_items gi
                join public.galleries g on g.id = gi.gallery_id
               where gi.media_asset_id = media_assets.id
                 and g.publication_status = 'PUBLISHED')
  );

commit;
