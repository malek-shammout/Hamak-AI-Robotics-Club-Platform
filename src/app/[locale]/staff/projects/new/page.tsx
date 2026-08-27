import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {ProjectForm} from '@/components/authoring/project-form';
import {requireUser} from '@/lib/auth/session';
import type {Locale} from '@/i18n/routing';

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  await requireUser(l);
  const t = await getTranslations('authoring');

  return (
    <>
      <Link href="/staff/projects" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToProjects')}
      </Link>
      <PageHeading title={t('newProject')} lead={t('newProjectLead')} />
      <ProjectForm />
    </>
  );
}
