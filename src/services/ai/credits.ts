/**
 * Charging AI credits.
 *
 * Thin on purpose: the atomicity that makes this safe lives in the
 * `charge_ai_credits` SECURITY DEFINER function, whose `where ai_credits >= p_amount`
 * makes check-and-debit one statement. Doing it here — read balance, compare, write
 * — would let two concurrent requests both pass the check and both spend the last
 * credit.
 *
 * SECURITY: the function derives its user from `auth.uid()`, not from an argument,
 * so this client is the cookie-bound one and there is deliberately no way for a
 * caller to name whose credits get charged.
 */

import "server-only";

import { createSupabaseServerClient } from "@/services/supabase/server";
import { PG_ERROR } from "@/types/db";
import { AiError } from "./errors";

/**
 * Debits `amount` credits and returns the balance that remains.
 *
 * Called *before* the model runs, which is the deliberate trade: a provider failure
 * after a successful charge costs the user credits they got nothing for, but the
 * reverse order lets a caller who aborts mid-stream generate for free. There is no
 * refund path by design — refunds reopen the double-spend window the atomic debit
 * closes, and the ledger row records what was charged either way.
 */
export async function chargeCredits(amount: number): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("charge_ai_credits", { p_amount: amount });

  if (error) {
    if (error.code === PG_ERROR.INSUFFICIENT_RESOURCES) {
      throw new AiError("insufficient_credits", { cause: error });
    }

    // Anything else is a broken database or a revoked grant. Fail closed: an
    // unmetered AI call is worse than a failed one.
    throw new AiError("unknown", { cause: error });
  }

  return data;
}
