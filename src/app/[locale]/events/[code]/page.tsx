import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {MetaPill} from '@/components/public/meta-pill';
import {getEventByCode} from '@/lib/queries/public';
import {localised} from '@/lib/utils';
import {formatDateTime, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{locale: string; code: string}>;
}) {
  const {locale, code} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('events');
  const tCommon = await getTranslations('common');
  const tEnum = await getTranslations('enums');
  const l = locale as Locale;

  const event = await getEventByCode(code);
  if (!event) notFound();

  const sessions = [...(event.event_sessions ?? [])].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  return (
    <article>
      <Link href="/events" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {tCommon('backToList')}
      </Link>

      <PageHeading title={localised(event, 'title', l)} />

      <div className="mb-8 flex flex-wrap gap-2">
        <MetaPill tone="accent">{tEnum(`eventType.${event.type}`)}</MetaPill>
        <MetaPill>{tEnum(`eligibility.${event.eligibility}`)}</MetaPill>
        <MetaPill>
          <time dateTime={isoDate(event.starts_at)}>{formatDateTime(event.starts_at, l)}</time>
        </MetaPill>
        {event.venues?.name ? <MetaPill>{event.venues.name}</MetaPill> : null}
        {event.capacity ? (
          <MetaPill>{`${t('capacity')}: ${event.capacity}`}</MetaPill>
        ) : null}
      </div>

      <div className="space-y-8">
        {event.description ? (
          <p className="max-w-3xl whitespace-pre-line text-[--foreground-muted]">
            {event.description}
          </p>
        ) : null}

        {sessions.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xl font-semibold">{t('agenda')}</h2>
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s.id} className="hmk-card p-4">
                  <p className="font-medium">{s.title}</p>
                  <p className="mt-1 text-sm text-[--foreground-muted]">
                    <time dateTime={isoDate(s.starts_at)}>{formatDateTime(s.starts_at, l)}</time>
                    {s.room ? ` · ${s.room}` : ''}
                    {s.speaker_name ? ` · ${t('speaker')}: ${s.speaker_name}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  );
}
