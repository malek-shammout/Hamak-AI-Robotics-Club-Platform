'use server';

import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

export type AuthoringState = {error?: string; ok?: string} | undefined;

const CHOICE_TYPES = ['SINGLE_CHOICE', 'MULTI_CHOICE', 'TRUE_FALSE'] as const;

const questionSchema = z.object({
  type: z.enum(['SINGLE_CHOICE', 'MULTI_CHOICE', 'TRUE_FALSE', 'NUMERIC', 'SHORT_ANSWER', 'CODE']),
  stem: z.string().trim().min(5).max(4000),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  maxScore: z.coerce.number().positive().max(1000),
  gradingRubric: z.string().trim().max(4000).optional().nullable(),
});

/**
 * Creates a question and, for choice types, its options.
 *
 * Inserts run under the caller's own RLS (M4.CREATE) rather than through a definer
 * function - authoring needs no elevated rights, so it should not have any.
 *
 * `auto_gradable` is DERIVED from the type, never taken from the form: a SHORT_ANSWER
 * marked auto-gradable would be scored 0 forever, silently.
 */
export async function createQuestion(
  _prev: AuthoringState,
  formData: FormData
): Promise<AuthoringState> {
  const parsed = questionSchema.safeParse({
    type: formData.get('type'),
    stem: formData.get('stem'),
    difficulty: formData.get('difficulty'),
    maxScore: formData.get('maxScore'),
    gradingRubric: formData.get('gradingRubric') || null,
  });
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const isChoice = (CHOICE_TYPES as readonly string[]).includes(parsed.data.type);
  const autoGradable = isChoice;

  // CK_MANUAL_NEEDS_RUBRIC: a manually graded question must tell the grader how.
  if (!autoGradable && !parsed.data.gradingRubric) {
    return {error: 'RUBRIC_REQUIRED'};
  }

  const options: {text: string; correct: boolean}[] = [];
  if (isChoice) {
    for (let i = 0; i < 6; i++) {
      const text = String(formData.get(`optionText${i}`) ?? '').trim();
      if (!text) continue;
      const correct =
        parsed.data.type === 'MULTI_CHOICE'
          ? formData.get(`optionCorrect${i}`) === 'on'
          : formData.get('correctIndex') === String(i);
      options.push({text, correct});
    }
    if (options.length < 2) return {error: 'NEED_TWO_OPTIONS'};
    if (!options.some((o) => o.correct)) return {error: 'NEED_CORRECT_OPTION'};
  }

  const supabase = await createClient();

  const {data: question, error} = await supabase
    .from('questions')
    .insert({
      type: parsed.data.type,
      stem: parsed.data.stem,
      difficulty: parsed.data.difficulty,
      max_score: parsed.data.maxScore,
      auto_gradable: autoGradable,
      grading_rubric: parsed.data.gradingRubric,
    })
    .select('id')
    .single();

  if (error || !question) {
    return {error: error?.message.includes('row-level security') ? 'FORBIDDEN' : 'UNEXPECTED'};
  }

  if (options.length > 0) {
    const {error: optErr} = await supabase.from('question_options').insert(
      options.map((o, i) => ({
        question_id: question.id,
        order_index: i,
        option_text: o.text,
        is_correct: o.correct,
      }))
    );
    // A question with no usable options is worse than none: remove the orphan.
    if (optErr) {
      await supabase.from('questions').delete().eq('id', question.id);
      return {error: 'UNEXPECTED'};
    }
  }

  revalidatePath('/[locale]/staff/questions', 'page');
  return {ok: 'CREATED'};
}

export async function newQuestionVersion(
  _prev: AuthoringState,
  formData: FormData
): Promise<AuthoringState> {
  const parsed = z.string().uuid().safeParse(formData.get('questionId'));
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {error} = await supabase.rpc('clone_question_as_new_version', {
    p_question_id: parsed.data,
  });
  if (error) return {error: error.message.includes('FORBIDDEN') ? 'FORBIDDEN' : 'UNEXPECTED'};

  revalidatePath('/[locale]/staff/questions', 'page');
  return {ok: 'VERSIONED'};
}
