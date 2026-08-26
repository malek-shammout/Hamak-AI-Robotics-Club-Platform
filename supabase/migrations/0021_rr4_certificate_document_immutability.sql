-- =====================================================================================
--  HMK Platform - Migration 0021
--  RR-4: certificate document immutability
-- =====================================================================================
--  D-19 SCHEMA ADDITION, sanctioned by the frozen analysis.
--    Part D.3 names RR-4's mitigation as "Versioned bucket + content hash stored on
--    media_assets". The column did not exist because the ERD in Part C predates that
--    mitigation. This is an ANTICIPATED addition, not an invention - but Rules of
--    Engagement #1 still requires it recorded, so it is D-19 in claude.md section 3.
--
--    ENTITY COUNT IS UNCHANGED: 78 tables. Two columns added to an existing table.
--
--  THE IMMUTABILITY MODEL - three independent locks:
--    1. The `certificates` bucket has NO client storage policy at all. Neither anon nor
--       authenticated can read or write it in any circumstance (migration 0002).
--       Delivery is exclusively by short-lived signed URL minted server-side.
--    2. media_assets.content_hash records the SHA-256 of the bytes at issuance. A
--       document that no longer hashes to its recorded value has been tampered with,
--       and that stays detectable forever.
--    3. WRITE-ONCE: once a media_asset backs a certificate, its storage_key and
--       content_hash can never change and it cannot be deleted. Re-rendering must
--       create a NEW object and supersede the certificate, never mutate the old one.
--       A credential whose document can be swapped is not a credential.
--
--  A fourth lock lives outside the database: the upload uses `upsert: false`, so the
--  storage layer itself refuses to overwrite an existing certificate object.
--
--  VERIFIED by supabase/tests/10_rr4_certificate_document_immutability.sql (rolled back):
--    * no storage policy references the certificates bucket
--    * the content hash is recorded and linked to the certificate
--    * a malformed hash is rejected; a second document per certificate is rejected
--    * rewriting storage_key                 -> CERTIFICATE_DOCUMENT_IMMUTABLE
--    * rewriting content_hash to match forged bytes -> CERTIFICATE_DOCUMENT_IMMUTABLE
--    * deleting the backing asset            -> refused
--    * ordinary (non-certificate) media stays freely editable
--
--  Applied via MCP as `rr4_certificate_document_immutability`.
-- =====================================================================================

set search_path = public, extensions, pg_catalog;

begin;

alter table public.media_assets
  add column if not exists content_hash varchar(64),
  add column if not exists hash_algorithm varchar(16) not null default 'SHA-256';

comment on column public.media_assets.content_hash is
  'RR-4 / D-19. Lowercase hex digest of the stored bytes, taken at upload. For a certificate document this is the tamper-evidence: a file that no longer hashes to this value has been altered. Immutable once the asset is referenced by a certificate.';

-- ===== AUTHORITATIVE FUNCTION BODIES (exported from the live database) =====

CREATE OR REPLACE FUNCTION app.assert_certificate_document_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  -- Only assets actually backing a certificate are frozen. Ordinary media stays editable.
  if exists (select 1 from public.certificates c where c.document_media_id = old.id) then
    if new.storage_key is distinct from old.storage_key
       or new.content_hash is distinct from old.content_hash then
      raise exception
        'CERTIFICATE_DOCUMENT_IMMUTABLE: this media asset backs an issued certificate. '
        'Re-render as a NEW object and supersede the certificate; never mutate the '
        'stored document (RR-4).'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION app.assert_certificate_document_not_deleted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if exists (select 1 from public.certificates c where c.document_media_id = old.id) then
    raise exception
      'CERTIFICATE_DOCUMENT_IMMUTABLE: cannot delete a media asset that backs an issued certificate (RR-4).'
      using errcode = 'P0001';
  end if;
  return old;
end $function$;

CREATE OR REPLACE FUNCTION public.attach_certificate_document(p_certificate_id uuid, p_storage_key text, p_content_hash text, p_byte_size bigint, p_mime_type text DEFAULT 'application/pdf'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_cert record; v_media uuid;
begin
  if not (app.has_perm('M6.CREATE') or app.has_perm('M6.APPROVE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if p_content_hash is null or length(p_content_hash) <> 64 then
    raise exception 'INVALID_CONTENT_HASH' using errcode='P0001';
  end if;

  select c.* into v_cert from public.certificates c
   where c.id = p_certificate_id for update;
  if not found then raise exception 'CERTIFICATE_NOT_FOUND' using errcode='P0002'; end if;

  -- One document per certificate, forever. A second render must supersede, not replace.
  if v_cert.document_media_id is not null then
    raise exception 'DOCUMENT_ALREADY_ATTACHED' using errcode='P0001';
  end if;

  insert into public.media_assets (storage_key, mime_type, byte_size, content_hash,
                                   usage_rights, uploaded_by, caption)
  values (p_storage_key, p_mime_type, p_byte_size, lower(p_content_hash),
          'CLUB_OWNED', v_uid, 'Certificate ' || v_cert.serial_no)
  returning id into v_media;

  update public.certificates set document_media_id = v_media where id = p_certificate_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, after_state)
  values (v_uid, 'ATTACH_CERTIFICATE_DOCUMENT', 'certificates', p_certificate_id,
          jsonb_build_object('media_asset_id', v_media, 'content_hash', lower(p_content_hash),
                             'byte_size', p_byte_size));

  return v_media;
end $function$;


drop trigger if exists trg_certificate_document_immutable on public.media_assets;
create trigger trg_certificate_document_immutable
  before update of storage_key, content_hash on public.media_assets
  for each row execute function app.assert_certificate_document_immutable();

drop trigger if exists trg_certificate_document_no_delete on public.media_assets;
create trigger trg_certificate_document_no_delete
  before delete on public.media_assets
  for each row execute function app.assert_certificate_document_not_deleted();

revoke all on function public.attach_certificate_document(uuid, text, text, bigint, text) from public, anon;
grant execute on function public.attach_certificate_document(uuid, text, text, bigint, text) to authenticated;

commit;
