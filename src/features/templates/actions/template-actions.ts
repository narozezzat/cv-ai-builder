"use server";

/**
 * The template feature's only write: starring a template.
 *
 * SECURITY, same order as the resume actions:
 *
 * 1. A `"use server"` export is a public HTTP endpoint, so the input is re-parsed here
 *    with the same schema the client used.
 * 2. The user id comes from `requireUser()`. It is written into `user_id` from the
 *    session and never accepted from the caller — which is also what makes the RLS
 *    `with check (auth.uid() = user_id)` a second lock on the same door rather than the
 *    only one.
 * 3. Statements go through the cookie-bound client, so a delete can only ever remove the
 *    caller's own row. `.eq("user_id", …)` below is *not* load-bearing for that; it is
 *    there because `template_favorites` has a composite key and a delete without it
 *    would be a statement whose correctness depends on the policy alone.
 */

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/components/shared/form";
import { rateLimitSubject } from "@/lib/request";
import { routes } from "@/lib/routes";
import { enforceRateLimit, rateLimitMessage } from "@/services/rate-limit";
import { createSupabaseServerClient, requireUser } from "@/services/supabase/server";

import { TEMPLATE_RATE_LIMITS } from "../lib/rate-limits";
import { toggleTemplateFavoriteSchema } from "../schema/template-schema";

const INVALID_INPUT = "Check your selection and try again.";
const FAILED = "Could not update your favourites. Try again.";

export async function toggleTemplateFavoriteAction(input: unknown): Promise<ActionResult> {
  const parsed = toggleTemplateFavoriteSchema.safeParse(input);

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? INVALID_INPUT);
  }

  const { templateId, isFavorite } = parsed.data;
  const user = await requireUser();
  const rule = TEMPLATE_RATE_LIMITS.favorite;
  const limit = await enforceRateLimit(rule, rateLimitSubject(`${rule.action}:user`, user.id));

  if (!limit.allowed) {
    return actionError(rateLimitMessage(limit.reason));
  }

  const supabase = await createSupabaseServerClient();

  // `upsert` with `ignoreDuplicates`, so starring something already starred is a no-op
  // rather than a 23505 the UI would have to translate. The composite primary key is
  // what makes that possible without a read first.
  const { error } = isFavorite
    ? await supabase
        .from("template_favorites")
        .upsert({ user_id: user.id, template_id: templateId }, { ignoreDuplicates: true })
    : await supabase
        .from("template_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("template_id", templateId);

  if (error) {
    console.error("[templates] favourite write failed", {
      code: error.code,
      message: error.message,
    });

    return actionError(FAILED);
  }

  // Only the gallery reads favourites. Scoped to the page, not the layout: the dashboard
  // shell above it does not change, and a star is the cheapest possible mutation — it
  // should not re-run the stat cards.
  revalidatePath(routes.templateGallery);

  return actionSuccess(isFavorite ? "Added to favourites." : "Removed from favourites.");
}
