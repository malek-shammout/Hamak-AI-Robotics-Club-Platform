import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {MetaPill} from '@/components/public/meta-pill';
import {getProjectByCode} from '@/lib/queries/public';
import {localised} from '@/lib/utils';
import {formatDate, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{locale: string; code: string}>;
}) {
  const {locale, code} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('projects');
  const tCommon = await getTranslations('common');
  const tEnum = await getTranslations('enums');
  const l = locale as Locale;

  const project = await getProjectByCode(code);
  if (!project) notFound();

  const techs = (project.project_technologies ?? [])
    .map((pt) => pt.technologies?.name)
    .filter(Boolean) as string[];

  return (
    <article>
      <Link href="/projects" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {tCommon('backToList')}
      </Link>

      <PageHeading title={localised(project, 'title', l)} />

      <div className="mb-8 flex flex-wrap gap-2">
        <MetaPill tone="accent">{tEnum(`projectStatus.${project.status}`)}</MetaPill>
        {project.start_on ? (
          <MetaPill>
            <time dateTime={isoDate(project.start_on)}>{formatDate(project.start_on, l)}</time>
          </MetaPill>
        ) : null}
      </div>

      <div className="space-y-8">
        {project.abstract ? (
          <p className="max-w-3xl text-[--foreground-muted]">{project.abstract}</p>
        ) : null}

        {project.problem_statement ? (
          <section>
            <h2 className="mb-2 text-xl font-semibold">{t('problem')}</h2>
            <p className="whitespace-pre-line text-[--foreground-muted]">
              {project.problem_statement}
            </p>
          </section>
        ) : null}

        {project.outcome ? (
          <section>
            <h2 className="mb-2 text-xl font-semibold">{t('outcome')}</h2>
            <p className="whitespace-pre-line text-[--foreground-muted]">{project.outcome}</p>
          </section>
        ) : null}

        {techs.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xl font-semibold">{t('technologies')}</h2>
            <div className="flex flex-wrap gap-2">
              {techs.map((name) => (
                <MetaPill key={name}>{name}</MetaPill>
              ))}
            </div>
          </section>
        ) : null}

        {(project.project_members ?? []).length > 0 ? (
          <section>
            <h2 className="mb-3 text-xl font-semibold">{t('team')}</h2>
            <ul className="space-y-2">
              {(project.project_members ?? []).map((m, i) => (
                <li key={i} className="hmk-card flex flex-wrap items-center gap-3 p-4">
                  <span className="font-medium">
                    {m.users ? localised(m.users, 'full_name', l) : tCommon('notAvailable')}
                  </span>
                  <MetaPill>{tEnum(`projectRole.${m.role_in_project}`)}</MetaPill>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  );
}
