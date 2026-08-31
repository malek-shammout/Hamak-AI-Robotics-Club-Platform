import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {
  GraduationCap, ClipboardList, FileCheck2, Boxes, Award,
  MessagesSquare, FolderGit2, CalendarDays, Newspaper, Wrench,
} from 'lucide-react';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {requireUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import type {Locale} from '@/i18n/routing';

/**
 * The staff hub.
 *
 * Until this existed every staff screen was reachable only by typing its URL, so the
 * authoring UI added in Session 007 would have been invisible to the people meant to
 * use it. Tiles are filtered by the caller's permissions — courtesy, not enforcement:
 * each destination re-checks, and RLS governs every read behind it.
 */
export default async function StaffHubPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  await requireUser(l);
  const t = await getTranslations('staffHub');

  const [m2, m3, m4, m5, m6, m7, m8, m9] = await Promise.all([
    hasPermission('M2.READ'),
    hasPermission('M3.READ'),
    hasPermission('M4.READ'),
    hasPermission('M5.READ'),
    hasPermission('M6.READ'),
    hasPermission('M7.READ'),
    hasPermission('M8.READ'),
    hasPermission('M9.READ'),
  ]);

  const tiles = [
    {show: m3, href: '/staff/cohorts', icon: GraduationCap, key: 'cohorts'},
    {show: m4, href: '/staff/questions', icon: ClipboardList, key: 'questions'},
    {show: m4, href: '/staff/grading', icon: FileCheck2, key: 'grading'},
    {show: m6, href: '/staff/clearance', icon: Award, key: 'clearance'},
    {show: m5, href: '/staff/desk', icon: Boxes, key: 'desk'},
    {show: m5, href: '/staff/requisitions', icon: Wrench, key: 'requisitions'},
    {show: m2, href: '/staff/consultations', icon: MessagesSquare, key: 'consultations'},
    {show: m2, href: '/staff/expertise', icon: MessagesSquare, key: 'expertise'},
    {show: m7, href: '/staff/projects', icon: FolderGit2, key: 'projects'},
    {show: m8, href: '/staff/events', icon: CalendarDays, key: 'events'},
    {show: m9, href: '/staff/news', icon: Newspaper, key: 'articles'},
  ].filter((tile) => tile.show);

  return (
    <>
      <PageHeading title={t('title')} lead={t('lead')} />

      {tiles.length === 0 ? (
        // Being signed in is not being staff. Say so plainly rather than showing an
        // empty grid that looks broken.
        <EmptyState message={t('noAccess')} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) => (
            <li key={tile.href}>
              <Link
                href={tile.href}
                className="hmk-card flex h-full items-start gap-4 p-5 transition-colors
                           hover:border-hmk-red"
              >
                <tile.icon className="mt-0.5 h-5 w-5 shrink-0 text-hmk-red" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-semibold">{t(`tiles.${tile.key}.title`)}</p>
                  <p className="text-sm text-[--foreground-muted]">
                    {t(`tiles.${tile.key}.body`)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
