import { supabase } from './supabase';
import { PlanTemplate, ReadingPlan } from '../types';

/**
 * Get all built-in plan templates for browsing (default plan catalog).
 */
export async function getPlanTemplates(): Promise<PlanTemplate[]> {
  const { data, error } = await supabase
    .from('plan_templates')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

/**
 * Clone a plan template into a real reading_plans + plan_readings row,
 * with scheduled_date computed sequentially from startDate — the same
 * dateless-import mechanism plans.ts already uses for pasted text, just
 * sourced from a stored template instead of a text box. The result is
 * a plain ReadingPlan ready to hand to createGroup, exactly like
 * importReadingPlan's return value.
 */
export async function instantiateTemplate(
  templateId: string,
  startDate: string, // YYYY-MM-DD
  createdBy: string
): Promise<ReadingPlan> {
  const { data: template, error: templateError } = await supabase
    .from('plan_templates')
    .select('name')
    .eq('id', templateId)
    .single();

  if (templateError) throw templateError;

  const { data: templateReadings, error: readingsError } = await supabase
    .from('plan_template_readings')
    .select('day_number, passages')
    .eq('template_id', templateId)
    .order('day_number');

  if (readingsError) throw readingsError;
  if (!templateReadings || templateReadings.length === 0) {
    throw new Error('This plan template has no readings configured.');
  }

  const start = new Date(startDate + 'T00:00:00');
  const minDay = templateReadings[0].day_number;

  const { data: plan, error: planError } = await supabase
    .from('reading_plans')
    .insert({
      name: template.name,
      total_days: templateReadings.length,
      is_public: false,
      created_by: createdBy,
    })
    .select()
    .single();

  if (planError) {
    if (planError.code === '23505') {
      const err: any = new Error(`You already have a plan named "${template.name}". Please use a different name.`);
      err.code = '23505';
      throw err;
    }
    throw planError;
  }

  const planReadings = templateReadings.map((r) => {
    const d = new Date(start);
    d.setDate(d.getDate() + (r.day_number - minDay));
    return {
      plan_id: plan.id,
      scheduled_date: d.toISOString().slice(0, 10),
      passages: r.passages,
    };
  });

  const { error: insertError } = await supabase
    .from('plan_readings')
    .insert(planReadings);

  if (insertError) {
    // Clean up the plan row if readings insert fails
    await supabase.from('reading_plans').delete().eq('id', plan.id);
    throw insertError;
  }

  return plan;
}
