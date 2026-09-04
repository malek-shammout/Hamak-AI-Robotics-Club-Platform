'use client';

import {useState} from 'react';
import {Menu, X} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {SignOutButton} from './auth/sign-out-button';
import {LanguageToggle} from './language-toggle';
import {ThemeToggle} from './theme-toggle';

type NavigationLink = {
  href:
    | '/courses'
    | '/projects'
    | '/consultations'
    | '/events'
    | '/news'
    | '/me/applications'
    | '/me/enrollments'
    | '/me/certificates'
    | '/me/consultations'
    | '/staff';
  label: string;
};

type MobileNavigationProps = {
  links: NavigationLink[];
  signedInLinks: NavigationLink[];
  userName?: string;
  signInLabel: string;
  signOutLabel: string;
  menuLabel: string;
  closeLabel: string;
  navigationLabel: string;
};

export function MobileNavigation({
  links,
  signedInLinks,
  userName,
  signInLabel,
  signOutLabel,
  menuLabel,
  closeLabel,
  navigationLabel,
}: MobileNavigationProps) {
  const [open, setOpen] = useState(false);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-navigation-drawer"
        aria-label={open ? closeLabel : menuLabel}
        className="grid h-10 w-10 place-items-center rounded-[--radius-control] border
                   border-[--border] text-[--foreground] transition-colors hover:border-hmk-red
                   hover:text-hmk-red md:hidden"
      >
        {open ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Menu className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label={closeLabel}
            onClick={closeMenu}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div
            id="mobile-navigation-drawer"
            className="relative mt-16 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b
                       border-[--border] bg-[--surface] px-4 py-5 shadow-lg"
          >
            <nav aria-label={navigationLabel} className="grid gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className="rounded-[--radius-control] px-3 py-3 text-base font-medium
                             text-[--foreground] transition-colors hover:bg-[--surface-muted]
                             hover:text-hmk-red"
                >
                  {link.label}
                </Link>
              ))}

              {userName ? (
                <>
                  <div className="mt-3 border-t border-[--border] px-3 pt-3 text-sm text-[--foreground-muted]">
                    {userName}
                  </div>
                  {signedInLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMenu}
                      className="rounded-[--radius-control] px-3 py-3 text-base font-medium
                                 text-[--foreground] transition-colors hover:bg-[--surface-muted]
                                 hover:text-hmk-red"
                    >
                      {link.label}
                    </Link>
                  ))}
                  <div className="mt-2 px-3">
                    <SignOutButton label={signOutLabel} />
                  </div>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className="mt-3 rounded-[--radius-control] border border-[--border] px-3 py-3
                             text-center text-base font-medium text-[--foreground]
                             transition-colors hover:border-hmk-red hover:text-hmk-red"
                >
                  {signInLabel}
                </Link>
              )}
            </nav>

            <div className="mt-5 flex items-center gap-2 border-t border-[--border] pt-4">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
