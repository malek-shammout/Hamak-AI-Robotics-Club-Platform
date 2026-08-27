'use server';

import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

export type CurationState = {error?: string; ok?: string} | undefined;

/**
 * A4 curates the expertise catalogue (D-06).
 *
 * These are plain inserts under the caller's own RLS — `staff_create` / `staff_update`
 * on both tables are gated on M2.CREATE / M2.UPDATE, which the PROJECTS role holds.
 * Curation needs no elevated rights, so it is given none; contrast the availability
 * toggle, which IS a definer function because a member must write one column of a row
 * they otherwise cannot touch at all.
 */

const uuid = z.string().uuid();
const PROFICIENCY = ['FAMILIAR', 'PROFICIENT', 'EXPERT'] as const;

export async function createExpertiseDomain(
  _prev: CurationState,
  formData: FormData
): Promise<CurationState> {
  const parsed = z
    .object({
      code: z.string().trim().min(2).max(32),
      nameAr: z.string().trim().min(1).max(120),
      nameEn: z.string().trim().min(1).max(120),
    })
    .safeParse({
      code: formData.get('code'),
      nameAr: formData.get('nameAr'),
      nameEn: formData.get('nameEn'),
    });
  // Both name forms are required (claude.md §0.5) — a domain with only one would render
  // blank on the other locale's page.
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {error} = await supabase.from('expertise_domains').insert({
    code: parsed.data.code.toUpperCase(),
    name_ar: parsed.data.nameAr,
    name_en: parsed.data.nameEn,
  });
  if (error) {
    if (/duplicate key/i.test(error.message)) return {error: 'DOMAIN_EXISTS'};
    return {error: /row-level security/i.test(error.message) ? 'FORBIDDEN' : 'UNEXPECTED'};
  }

  revalidatePath('/[locale]/staff/expertise', 'page');
  return {ok: 'CREATED'};
}

export async function setDomainActive(
  _prev: CurationState,
  formData: FormData
): Promise<CurationState> {
  const id = uuid.safeParse(formData.get('domainId'));
  if (!id.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  // Retiring a domain rather than deleting it: existing consultations reference it, and
  // there is no soft delete in this schema (claude.md §5 conventions).
  const {error} = await supabase
    .from('expertise_domains')
    .update({is_active: formData.get('active') === 'true'})
    .eq('id', id.data);
  if (error) return {error: /row-level security/i.test(error.message) ? 'FORBIDDEN' : 'UNEXPECTED'};

  revalidatePath('/[locale]/staff/expertise', 'page');
  return {ok: 'SAVED'};
}

/** Records that a member is an expert in a domain, at a stated proficiency and cap. */
export async function curateMemberExpertise(
  _prev: CurationState,
  formData: FormData
): Promise<CurationState> {
  const parsed = z
    .object({
      memberId: uuid,
      domainId: uuid,
      proficiency: z.enum(PROFICIENCY),
      maxLoad: z.coerce.number().int().min(1).max(20),
    })
    .safeParse({
      memberId: formData.get('memberId'),
      domainId: formData.get('domainId'),
      proficiency: formData.get('proficiency'),
      maxLoad: formData.get('maxLoad'),
    });
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) return {error: 'AUTH_REQUIRED'};

  const {error} = await supabase.from('member_expertise').insert({
    member_user_id: parsed.data.memberId,
    expertise_domain_id: parsed.data.domainId,
    proficiency: parsed.data.proficiency,
    max_concurrent_load: parsed.data.maxLoad,
    // Attribution comes from the session, never from the form — otherwise a curator
    // could credit the decision to someone else.
    curated_by: user.id,
    // D-06: the member decides whether they are actually taking work. A new entry starts
    // unavailable so nobody is enrolled into a queue without opting in.
    is_available: false,
  });
  if (error) {
    if (/duplicate key/i.test(error.message)) return {error: 'EXPERTISE_EXISTS'};
    return {error: /row-level security/i.test(error.message) ? 'FORBIDDEN' : 'UNEXPECTED'};
  }

  revalidatePath('/[locale]/staff/expertise', 'page');
  return {ok: 'CREATED'};
}

export async function removeMemberExpertise(
  _prev: CurationState,
  formData: FormData
): Promise<CurationState> {
  const id = uuid.safeParse(formData.get('expertiseId'));
  if (!id.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {error} = await supabase.from('member_expertise').delete().eq('id', id.data);
  if (error) return {error: /row-level security/i.test(error.message) ? 'FORBIDDEN' : 'UNEXPECTED'};

  revalidatePath('/[locale]/staff/expertise', 'page');
  return {ok: 'REMOVED'};
}
