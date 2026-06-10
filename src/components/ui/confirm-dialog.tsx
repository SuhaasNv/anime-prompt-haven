import * as React from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
}

const initialState: ConfirmState = {
  open: false,
  title: "",
  description: "",
  resolve: null,
};

let setDialogState: ((state: ConfirmState) => void) | null = null;

/**
 * Replacement for window.confirm(). Resolves true/false based on the user's
 * choice in the in-app dialog rendered by <ConfirmDialog />.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    setDialogState?.({ ...options, open: true, resolve });
  });
}

/** Mounted once near the app root; renders whatever confirm() last requested. */
export function ConfirmDialog() {
  const [state, setState] = React.useState<ConfirmState>(initialState);

  React.useEffect(() => {
    setDialogState = setState;
    return () => {
      setDialogState = null;
    };
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      state.resolve?.(false);
      setState(initialState);
    }
  };

  const handleConfirm = () => {
    state.resolve?.(true);
    setState(initialState);
  };

  return (
    <AlertDialog open={state.open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          <AlertDialogDescription>{state.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{state.cancelText ?? "Cancel"}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={cn(state.destructive && buttonVariants({ variant: "destructive" }))}
          >
            {state.confirmText ?? "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
