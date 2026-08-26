import {NextResponse, type NextRequest} from 'next/server';
import {createClient, createServiceRoleClient} from '@/lib/supabase/server';

/**
 * Short-lived signed-URL delivery for a certificate document (RR-4).
 *
 * The `certificates` bucket has NO client storage policy, so this route is the only
 * way the bytes reach anyone. Authorisation is decided by RLS BEFORE the service-role
 * client is touched: the caller's own client must be able to see the certificate row,
 * which the `self_read_own_certificate` and `staff_read` policies govern.
 *
 * The signed URL is deliberately short-lived. It is a bearer capability — anyone
 * holding the link can fetch the file until it expires — so the window is minutes,
 * not days, and it is minted per request rather than stored anywhere.
 */
const SIGNED_URL_TTL_SECONDS = 120;

export async function GET(
  request: NextRequest,
  {params}: {params: Promise<{id: string}>}
) {
  const {id} = await params;

  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({error: 'AUTH_REQUIRED'}, {status: 401});
  }

  // RLS is the authorisation check. If the caller may not see the row, they get
  // nothing — the same answer as a certificate that does not exist.
  const {data: cert} = await supabase
    .from('certificates')
    .select('id, serial_no, media_assets(storage_key, content_hash)')
    .eq('id', id)
    .maybeSingle();

  if (!cert) {
    return NextResponse.json({error: 'NOT_FOUND'}, {status: 404});
  }

  const storageKey = cert.media_assets?.storage_key;
  if (!storageKey) {
    return NextResponse.json({error: 'DOCUMENT_NOT_GENERATED'}, {status: 409});
  }

  let service;
  try {
    service = createServiceRoleClient();
  } catch {
    return NextResponse.json({error: 'SERVICE_ROLE_KEY_MISSING'}, {status: 503});
  }

  const {data: signed, error} = await service.storage
    .from('certificates')
    .createSignedUrl(storageKey, SIGNED_URL_TTL_SECONDS, {
      download: `${cert.serial_no}.pdf`,
    });

  if (error || !signed) {
    return NextResponse.json({error: 'SIGNING_FAILED'}, {status: 500});
  }

  // 302 rather than returning the URL as JSON: the link never lands in the page,
  // browser history, or a referrer header the client might forward on.
  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: {'Cache-Control': 'no-store, max-age=0'},
  });
}
