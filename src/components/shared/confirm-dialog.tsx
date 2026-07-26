"use client";

import { Loader2 } from "lucide-react";
import {
  useCallback,
  useState,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  /**
   * Element that opens the dialog — typically a `<Button>`. Merged into the
   * trigger via Base UI's `render` prop, so it must be a single element rather
   * than arbitrary nodes. Omit when driving `open` yourself.
   */
  trigger?: ReactElement<Record<string, unknown>>;
  title: ReactNode;
  description?: ReactNode;
  /** Icon for the header media slot — reinforces severity before the user reads. */
  icon?: ComponentType<{ className?: string }>;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * `destructive` renders a solid red confirm button. Use it for anything that
   * loses data; the default tinted style is for reversible confirmations.
   */
  tone?: "default" | "destructive";
  /**
   * Runs on confirm. If it returns a promise the dialog shows a pending state,
   * blocks double-submits, and closes only after it resolves — so the user never
   * sees the dialog vanish while the mutation is still in flight.
   */
  onConfirm: () => void | Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

/**
 * The one confirmation surface in the app. Wrapping AlertDialog here means the
 * pending state, the double-submit guard, and destructive styling are decided
 * once instead of re-implemented at each of the ~10 call sites (delete resume,
 * empty trash, revoke share link, discard AI suggestion, …).
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  icon: Icon,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  open,
  onOpenChange,
  children,
}: ConfirmDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      // Ignore dismissal attempts while the mutation is running: closing now
      // would strand the user with no feedback about whether it succeeded.
      if (pending && !next) return;
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange, pending],
  );

  const handleConfirm = useCallback(async () => {
    if (pending) return;

    try {
      const result = onConfirm();
      if (result instanceof Promise) {
        setPending(true);
        await result;
      }
      setPending(false);
      // Bypass `setOpen`'s pending guard — we just finished successfully.
      if (!isControlled) setUncontrolledOpen(false);
      onOpenChange?.(false);
    } catch {
      // Leave the dialog open so the user can retry. Surfacing the error is the
      // caller's job — it owns the mutation and its toast.
      setPending(false);
    }
  }, [isControlled, onConfirm, onOpenChange, pending]);

  return (
    <AlertDialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <AlertDialogTrigger render={trigger} /> : null}

      <AlertDialogContent>
        <AlertDialogHeader>
          {Icon ? (
            <AlertDialogMedia
              className={tone === "destructive" ? "bg-destructive/10 text-destructive" : undefined}
            >
              <Icon />
            </AlertDialogMedia>
          ) : null}
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>

        {children}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={tone === "destructive" ? "destructive-solid" : "default"}
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
