import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {MetaPill} from '@/components/public/meta-pill';
import {ProjectForm} from '@/components/authoring/project-form';
import {PublishControls} from '@/components/authoring/publish-controls';
import {TechnologyPicker} from '@/components/authoring/technology-picker';
import {requireUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {getStaffProject, getTechnologies} from '@/lib/queries/authoring';
import {localised} from '@/lib/utils';
import type {Locale} from '@/i18n/routing';

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  await requireUser(l);

  const project = await getStaffProject(id);
  // No row means RLS did not grant it — a 404 rather than a 403, because confirming an
  // id exists is itself a disclosure.
  if (!project) notFound();

  const t = await getTranslations('authoring');
  const tRole = await getTranslations('enums.projectRole');

  const [technologies, mayApprove] = await Promise.all([
    getTechnologies(),
    hasPermission('M7.APPROVE'),
  ]);

  const selected = (project.project_technologies ?? [])
    .map((pt) => pt.technology_id)
    .filter(Boolean);

  return (
    <>
      <Link href="/staff/projects" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToProjects')}
      </Link>

      <PageHeading title={localised(project, 'title', l)} />

      <section className="hmk-card mb-8 p-6">
        <h2 className="mb-4 text-lg font-semibold">{t('publication')}</h2>
        <PublishControls
          entity="projects"
          id={project.id}
          status={project.publication_status}
          mayApprove={mayApprove}
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">{t('details')}</h2>
        <ProjectForm defaults={project} />
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">{t('technologies')}</h2>
        <div className="hmk-card p-6">
          <TechnologyPicker
            projectId={project.id}
            technologies={technologies}
            selected={selected as string[]}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">{t('team')}</h2>
        {(project.project_members ?? []).length === 0 ? (
          <p className="text-sm text-[--foreground-muted]">{t('noTeam')}</p>
        ) : (
          <ul className="space-y-2">
            {(project.project_members ?? []).map((m, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center justify-between gap-3 border border-[--border] p-4 text-sm"
              >
                <span className="font-medium">
                  {m.users ? localised(m.users, 'full_name', l) : ''}
                </span>
                <MetaPill>{tRole(m.role_in_project)}</MetaPill>
              </li>
            ))}
          </ul>
        )}
        {/* Read-only by ruling, not by omission. Membership drives BR-12's project-custody
            branch — a member may raise a requisition against a project they belong to — so
            the club restricted it to ADMIN, the projects manager, or the project's own
            LEAD (D-23, migration 0026). The database enforces that; this screen simply
            does not offer an edit path that most viewers would be refused. */}
        <p className="mt-3 text-xs text-[--foreground-muted]">{t('teamNote')}</p>
      </section>
    </>
  );
}
