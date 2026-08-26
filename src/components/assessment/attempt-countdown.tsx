'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlarmClock} from 'lucide-react';

/**
 * Shows the remaining time on an attempt.
 *
 * DISPLAY ONLY. The deadline is set and enforced by the database
 * (start_test_attempt / save_attempt_answer). If a clock-skewed or tampered client
 * shows time remaining, the server still refuses the save. Never gate submission on
 * this component.
 */
export function AttemptCountdown({deadlineIso}: {deadlineIso: string}) {
  const t = useTranslations('screening');
  const [left, setLeft] = useState<number>(() => Date.parse(deadlineIso) - Date.now());

  useEffect(() => {
    const id = setInterval(() => setLeft(Date.parse(deadlineIso) - Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadlineIso]);

  const expired = left <= 0;
  const mins = Math.max(0, Math.floor(left / 60000));
  const secs = Math.max(0, Math.floor((left % 60000) / 1000));

  return (
    <p
      // Announce politely rather than on every tick.
      aria-live="polite"
      className={`inline-flex items-center gap-2 text-sm ${expired ? 'text-hmk-red' : 'text-[--foreground-muted]'}`}
    >
      <AlarmClock className="h-4 w-4" aria-hidden="true" />
      {expired ? t('timeUp') : t('timeLeft', {mins, secs: String(secs).padStart(2, '0')})}
    </p>
  );
}
