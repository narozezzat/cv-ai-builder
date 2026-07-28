import { Badge } from "@/components/ui/badge";

import { countTrashedResumes } from "../queries/resume-queries";

/**
 * The count on the "Trash" link, streamed inside the link itself.
 *
 * Deliberately has no skeleton: its boundary falls back to `null`. A shimmer inside
 * a button label would make the button visibly change width twice, and an absent
 * badge is already the correct rendering for an empty trash.
 */
export async function TrashCountBadge() {
  const count = await countTrashedResumes();

  if (count === 0) {
    return null;
  }

  return (
    <Badge variant="secondary" className="ml-1">
      {count}
    </Badge>
  );
}
