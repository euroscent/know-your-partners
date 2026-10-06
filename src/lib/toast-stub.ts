// Re-export toast from sonner for backward compatibility
export { toast } from "sonner";

// Adapter for useToast hook - wraps sonner's toast for shadcn/ui compatibility
import { toast as sonnerToast } from "sonner";

export const useToast = () => ({
  toast: (props: { title?: string; description?: string; variant?: string }) => {
    const message = props.title || props.description || "";
    if (props.variant === "destructive") {
      sonnerToast.error(message);
    } else {
      sonnerToast(message);
    }
    return { id: '', dismiss: () => {}, update: () => {} };
  },
  dismiss: (toastId?: string) => sonnerToast.dismiss(toastId),
  toasts: [],
});
