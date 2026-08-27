import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {EventForm} from '@/components/authoring/event-form';
import {VenueForm} from '@/components/authoring/venue-form';
import {requireUser} from '@/lib/auth/session';
import {getVenues} from '@/lib/queries/authoring';
import type {Locale} from '@/i18n/routing';

export default async function NewEventPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  await requireUser(l);
  const t = await getTranslations('authoring');
  const venues = await getVenues();

  return (
    <>
      <Link href="/staff/events" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToEvents')}
      </Link>
      <PageHeading title={t('newEvent')} lead={t('newEventLead')} />

      <EventForm venues={venues} />

      {/* An organiser creating the first event of the year has no venue to pick yet;
          sending them to a separate screen to make one is a dead end. */}
      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">{t('addVenue')}</h2>
        <VenueForm />
      </section>
    </>
  );
}
