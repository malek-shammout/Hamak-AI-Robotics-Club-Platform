import {getTranslations} from 'next-intl/server';
import {ExternalLink, MapPin} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';
import {BinaryBar} from './binary-bar';

type ClubLocation = {
  address_ar: string;
  address_en: string;
  maps_url: string;
  lat: number | null;
  lng: number | null;
};

/**
 * claude.md 9 - the club location is CONFIG, not an entity. It is read from
 * system_policies['club.location'].
 *
 * While lat/lng are null (the club has not confirmed the pin) this renders the
 * official deep link rather than an iframe centred on guessed coordinates.
 * Showing a map pointing at the wrong building is worse than showing a link.
 */
export async function ClubMap({locale}: {locale: 'ar' | 'en'}) {
  const t = await getTranslations('location');
  const supabase = await createClient();

  const {data} = await supabase
    .from('system_policies')
    .select('value')
    .eq('key', 'club.location')
    .maybeSingle();

  const loc = data?.value as ClubLocation | undefined;
  if (!loc) return null;

  const address = locale === 'ar' ? loc.address_ar : loc.address_en;
  const hasPin = loc.lat !== null && loc.lng !== null;

  return (
    <section className="hmk-card p-6" aria-labelledby="club-location-heading">
      <h2 id="club-location-heading" className="text-xl font-semibold">
        {t('heading')}
      </h2>
      <BinaryBar className="my-3" />

      <p className="flex items-start gap-2 text-[--foreground-muted]">
        <MapPin className="mt-1 h-4 w-4 shrink-0 text-hmk-red" aria-hidden="true" />
        <span>{address}</span>
      </p>

      {hasPin ? (
        <div className="mt-4 aspect-video w-full overflow-hidden rounded-[--radius-card]">
          <iframe
            title={t('mapTitle')}
            src={`https://www.google.com/maps?q=${loc.lat},${loc.lng}&hl=${locale}&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-full w-full border-0"
          />
        </div>
      ) : (
        <p className="mt-3 text-sm text-[--foreground-muted]">{t('pinPending')}</p>
      )}

      <a
        href={loc.maps_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-hmk-red
                   underline-offset-4 hover:underline"
      >
        {t('openInMaps')}
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </section>
  );
}
