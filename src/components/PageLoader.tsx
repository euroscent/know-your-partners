import { Loader2 } from "lucide-react";

interface PageLoaderProps {
  /** Optional text below the spinner */
  text?: string;
  /** Use "full" for full-page centering, "inline" for within a container */
  variant?: "full" | "inline";
}

export function PageLoader({ text, variant = "full" }: PageLoaderProps) {
  const wrapperClass =
    variant === "full"
      ? "min-h-[400px] flex items-center justify-center"
      : "flex items-center justify-center py-8";

  return (
    <div className={wrapperClass}>
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        {text && <p className="mt-3 text-sm text-muted-foreground">{text}</p>}
      </div>
    </div>
  );
}
