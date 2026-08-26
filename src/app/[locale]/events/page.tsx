import {getTranslations, setRequestLocale} from 'next-intl/server';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {CardGrid} from '@/components/public/card-grid';
import {ContentCard} from '@/components/public/content-card';
import {MetaPill} from '@/components/public/meta-pill';
import {getPublishedEvents} from '@/lib/queries/public';
import {localised} from '@/lib/utils';
import {formatDateTime} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function EventsPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('events');
  const tEnum = await getTranslations('enums');
  const l = locale as Locale;

  const events = await getPublishedEvents();
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.starts_at).getTime() >= now);
  const past = events.filter((e) => new Date(e.starts_at).getTime() < now);

  function card(e: (typeof events)[number]) {
    return (
      <ContentCard
        key={e.id}
        href={`/events/${e.code}`}
        title={localised(e, 'title', l)}
        description={e.description}
        meta={
          <>
            <MetaPill tone="accent">{tEnum(`eventType.${e.type}`)}</MetaPill>
            <MetaPill>{tEnum(`eligibility.${e.eligibility}`)}</MetaPill>
          </>
        }
        footer={formatDateTime(e.starts_at, l)}
      />
    );
  }

  return (
    <>
      <PageHeading title={t('title')} lead={t('lead')} />

      {events.length === 0 ? (
        <EmptyState message={t('empty')} />
      ) : (
        <div className="space-y-10">
          {upcoming.length > 0 ? (
            <section>
              <h2 className="mb-4 text-xl font-semibold">{t('upcoming')}</h2>
              <CardGrid>{upcoming.map(card)}</CardGrid>
            </section>
          ) : null}
          {past.length > 0 ? (
            <section>
              <h2 className="mb-4 text-xl font-semibold">{t('past')}</h2>
              <CardGrid>{past.map(card)}</CardGrid>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
