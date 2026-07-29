/**
 * Reads for the gallery.
 *
 * Both go through the cookie-bound client, so RLS is what scopes them — there is no
 * `user_id` filter in either query. That is deliberate and consistent with the rest of
 * the app: a filter in TypeScript is a convenience, and relying on one would make a
 * forgotten `.eq()` a data leak instead of a cosmetic bug.
 *
 * Note what is *not* here: the twenty template definitions. Those live in the registry
 * and ship with the bundle, so the gallery renders without a round-trip. This module
 * only fetches the two things the database actually owns — which templates are active,
 * and which ones this user starred.
 */

import "server-only";

import { cache } from "react";

import { createSupabaseServerClient } from "@/services/supabase/server";

/**
 * Template ids the signed-in user has starred.
 *
 * A `Set`, not an array: the gallery asks "is this one starred?" once per card, and
 * twenty linear scans over an array is the kind of thing that is fine until a favourite
 * list grows and nobody remembers why the grid got slow.
 *
 * An error resolves to an empty set rather than throwing. A failed favourites read means
 * stars render hollow; taking the whole gallery to an error boundary over decoration
 * would be the worse outcome.
 *
 * Memoized per request because the grid and the "Favourites" filter count both need it.
 */
export const getFavoriteTemplateIds = cache(async (): Promise<ReadonlySet<string>> => {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.from("template_favorites").select("template_id");

  if (error) {
    console.error("[templates] favourites load failed", {
      code: error.code,
      message: error.message,
    });

    return new Set();
  }

  return new Set((data ?? []).map((row) => row.template_id));
});

/**
 * Ids the catalogue currently offers, or `null` if the table could not be read.
 *
 * The registry is the design source of truth, but `resume_templates.is_active` is the
 * kill switch: a template found to render badly can be pulled without a deploy. The
 * gallery intersects the two.
 *
 * `null` — distinct from an empty set — means "unknown", and the gallery shows every
 * registry template in that case. An empty set would be indistinguishable from "all
 * twenty are deactivated" and would render an empty gallery on a transient error, which
 * is the failure mode where users conclude the product is broken.
 */
export const getActiveTemplateIds = cache(async (): Promise<ReadonlySet<string> | null> => {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("resume_templates")
    .select("id")
    .eq("is_active", true);

  if (error) {
    console.error("[templates] catalogue load failed", {
      code: error.code,
      message: error.message,
    });

    return null;
  }

  return new Set((data ?? []).map((row) => row.id));
});
