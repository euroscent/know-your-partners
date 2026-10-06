import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeadlineBadgeProps {
  dueDate: string | null | undefined;
  className?: string;
  /** When true, shows a larger card-style badge for detail pages */
  large?: boolean;
}

/**
 * Displays the remaining time until a task's due_date for the employee.
 * Renders nothing when no due_date is set (i.e. timer hasn't started yet
 * because demo data was not released).
 */
export const DeadlineBadge = ({ dueDate, className, large = false }: DeadlineBadgeProps) => {
  if (!dueDate) return null;

  const due = new Date(dueDate);
  const now = new Date();
  const msLeft = due.getTime() - now.getTime();
  const isOverdue = msLeft <= 0;

  const totalMinutes = Math.abs(Math.floor(msLeft / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);

  let label: string;
  if (isOverdue) {
    label = days > 0 ? `${days}T überfällig` : `${hours}h überfällig`;
  } else if (days > 0) {
    label = `Frist: noch ${days} Tag${days === 1 ? "" : "e"}${hours > 0 ? ` ${hours}h` : ""}`;
  } else {
    label = `Frist: noch ${hours}h`;
  }

  const isUrgent = !isOverdue && msLeft < 1000 * 60 * 60 * 12; // < 12h

  const colorClass = isOverdue
    ? "bg-destructive/10 border-destructive/30 text-destructive"
    : isUrgent
      ? "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300"
      : "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300";

  const Icon = isOverdue ? AlertTriangle : Clock;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium",
        large ? "px-3 py-2 text-sm" : "px-2 py-1 text-xs",
        colorClass,
        className,
      )}
      title={`Fällig am ${due.toLocaleString("de-DE")}`}
    >
      <Icon className={large ? "h-4 w-4" : "h-3.5 w-3.5"} />
      <span>{label}</span>
    </div>
  );
};

export default DeadlineBadge;
