import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {EventForm} from '@/components/authoring/event-form';
import {PublishControls} from '@/components/authoring/publish-controls';
import {SessionForm} from '@/components/authoring/session-form';
import {requireUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {getStaffEvent, getVenues} from '@/lib/queries/authoring';
import {localised} from '@/lib/utils';
import {formatDateTime, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function EditEventPage({
  params,
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  await requireUser(l);

  const event = await getStaffEvent(id);
  if (!event) notFound();

  const t = await getTranslations('authoring');
  const [venues, mayApprove] = await Promise.all([getVenues(), hasPermission('M8.APPROVE')]);

  const sessions = [...(event.event_sessions ?? [])].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  return (
    <>
      <Link href="/staff/events" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToEvents')}
      </Link>

      <PageHeading title={localised(event, 'title', l)} />

      <section className="hmk-card mb-8 p-6">
        <h2 className="mb-4 text-lg font-semibold">{t('publication')}</h2>
        <PublishControls
          entity="events"
          id={event.id}
          status={event.publication_status}
          mayApprove={mayApprove}
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">{t('details')}</h2>
        <EventForm defaults={event} venues={venues} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">{t('sessions')}</h2>

        {sessions.length === 0 ? (
          <p className="mb-4 text-sm text-[--foreground-muted]">{t('noSessions')}</p>
        ) : (
          <ul className="mb-6 space-y-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-[--border] p-4 text-sm"
              >
                <div className="space-y-1">
                  <p className="font-medium">{s.title}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-[--foreground-muted]">
                    <time dateTime={isoDate(s.starts_at)}>{formatDateTime(s.starts_at, l)}</time>
                    {s.room ? <span>{s.room}</span> : null}
                    {s.track ? <span>{s.track}</span> : null}
                    {s.speaker_name ? <span>{s.speaker_name}</span> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <SessionForm eventId={event.id} />
      </section>
    </>
  );
}
