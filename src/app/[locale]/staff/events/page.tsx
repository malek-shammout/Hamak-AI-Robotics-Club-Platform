import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {Plus, Users} from 'lucide-react';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {MetaPill} from '@/components/public/meta-pill';
import {requireUser} from '@/lib/auth/session';
import {getStaffEvents, getEventRegistrationCounts} from '@/lib/queries/authoring';
import {localised} from '@/lib/utils';
import {formatDateTime, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function StaffEventsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  await requireUser(l);

  const t = await getTranslations('authoring');
  const tPub = await getTranslations('enums.publicationStatus');
  const tType = await getTranslations('enums.eventType');

  const [events, counts] = await Promise.all([getStaffEvents(), getEventRegistrationCounts()]);

  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.starts_at).getTime() >= now);
  const past = events.filter((e) => new Date(e.starts_at).getTime() < now);

  function Row({e}: {e: (typeof events)[number]}) {
    const registered = counts.get(e.id) ?? 0;
    return (
      <li className="hmk-card flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="space-y-1">
          <Link href={`/staff/events/${e.id}`} className="font-semibold hover:text-hmk-red">
            {localised(e, 'title', l)}
          </Link>
          <p className="font-accent text-xs text-[--foreground-muted]" dir="ltr">
            {e.code}
          </p>
          <time dateTime={isoDate(e.starts_at)} className="block text-xs text-[--foreground-muted]">
            {formatDateTime(e.starts_at, l)}
          </time>
          {e.venues ? (
            <p className="text-xs text-[--foreground-muted]">{e.venues.name}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Registration uptake against capacity is the number an organiser actually
              needs at a glance. */}
          <span className="inline-flex items-center gap-1.5 text-xs text-[--foreground-muted]">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span dir="ltr" className="font-accent">
              {registered}
              {e.capacity ? `/${e.capacity}` : ''}
            </span>
          </span>
          <MetaPill>{tType(e.type)}</MetaPill>
          <MetaPill>{tPub(e.publication_status)}</MetaPill>
        </div>
      </li>
    );
  }

  return (
    <>
      <PageHeading title={t('eventsTitle')} lead={t('eventsLead')} />

      <Link
        href="/staff/events/new"
        className="mb-10 inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-5
                   py-2.5 text-sm font-semibold text-white hover:bg-hmk-red-hover"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t('newEvent')}
      </Link>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">{t('upcomingTitle')}</h2>
        {upcoming.length === 0 ? (
          <EmptyState message={t('noUpcoming')} />
        ) : (
          <ul className="space-y-3">
            {upcoming.map((e) => (
              <Row key={e.id} e={e} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('pastTitle')}</h2>
          <ul className="space-y-3">
            {past.map((e) => (
              <Row key={e.id} e={e} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
