import 'server-only';

import {createClient, createServiceRoleClient} from '@/lib/supabase/server';
import {renderCertificatePdf} from './render';

export type IssueDocumentResult =
  | {ok: true; storageKey: string; sha256: string; byteSize: number}
  | {ok: false; error: string};

/**
 * S3 — Certificate Renderer.
 *
 * Renders the document, uploads it to the PRIVATE `certificates` bucket, and records
 * the hash against the certificate (RR-4).
 *
 * Uses the SERVICE-ROLE client, and this is one of the two sanctioned uses named in
 * claude.md §6. It is unavoidable: the bucket has no client storage policy at all, by
 * design, so no anon or authenticated role can write it in any circumstance.
 *
 * `upsert: false` makes the storage layer refuse to overwrite an existing object —
 * a third lock on top of the write-once trigger and the hash. Re-rendering must
 * produce a new key, never replace bytes behind an issued credential.
 */
export async function issueCertificateDocument(
  certificateId: string,
  origin: string
): Promise<IssueDocumentResult> {
  const supabase = await createClient();

  // Read through the CALLER's client so RLS decides what they may see. The
  // service-role client is used only for the storage write below.
  const {data: cert} = await supabase
    .from('certificates')
    .select('id, serial_no, verification_code, issued_at, issued_under_override, document_media_id, enrollments(users!student_user_id(full_name_ar, full_name_en), cohorts(code, courses(title_ar, title_en)))')
    .eq('id', certificateId)
    .maybeSingle();

  if (!cert) return {ok: false, error: 'CERTIFICATE_NOT_FOUND'};
  if (cert.document_media_id) return {ok: false, error: 'DOCUMENT_ALREADY_ATTACHED'};

  const student = cert.enrollments?.users;
  const course = cert.enrollments?.cohorts?.courses;

  let rendered;
  try {
    rendered = await renderCertificatePdf({
      serialNo: cert.serial_no,
      verificationCode: cert.verification_code,
      studentNameAr: student?.full_name_ar ?? '',
      studentNameEn: student?.full_name_en ?? '',
      courseTitleAr: course?.title_ar ?? '',
      courseTitleEn: course?.title_en ?? '',
      cohortCode: cert.enrollments?.cohorts?.code ?? '',
      issuedAt: new Date(cert.issued_at).toISOString().slice(0, 10),
      issuedUnderOverride: Boolean(cert.issued_under_override),
      verifyUrl: `${origin}/ar/verify`,
    });
  } catch (err) {
    // The most common cause by far is a missing Chromium binary.
    return {
      ok: false,
      error:
        err instanceof Error && /executable|browserType|install/i.test(err.message)
          ? 'RENDERER_UNAVAILABLE'
          : 'RENDER_FAILED',
    };
  }

  // Key includes the hash, so a re-render can never collide with the original object.
  const storageKey = `${cert.id}/${rendered.sha256.slice(0, 16)}.pdf`;

  let service;
  try {
    service = createServiceRoleClient();
  } catch {
    return {ok: false, error: 'SERVICE_ROLE_KEY_MISSING'};
  }

  const {error: uploadError} = await service.storage
    .from('certificates')
    .upload(storageKey, rendered.bytes, {
      contentType: 'application/pdf',
      upsert: false, // never overwrite an existing certificate object
    });
  if (uploadError) return {ok: false, error: 'UPLOAD_FAILED'};

  // Record the hash through the CALLER's rights, so the audit row names the human.
  const {error: attachError} = await supabase.rpc('attach_certificate_document', {
    p_certificate_id: certificateId,
    p_storage_key: storageKey,
    p_content_hash: rendered.sha256,
    p_byte_size: rendered.byteSize,
    p_mime_type: 'application/pdf',
  });

  if (attachError) {
    // The row is the source of truth; an orphaned object is harmless, a mislinked
    // one is not. Remove the upload rather than leave the two disagreeing.
    await service.storage.from('certificates').remove([storageKey]);
    return {ok: false, error: 'ATTACH_FAILED'};
  }

  return {ok: true, storageKey, sha256: rendered.sha256, byteSize: rendered.byteSize};
}
