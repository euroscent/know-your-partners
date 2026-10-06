import { supabase } from "@/integrations/supabase/client";

export interface ProductTestStepLike {
  id: string;
  type: string;
}

/** Findet den Produkttest-Schritt in einer Task-Schritt-Liste. */
export const findProductTestStep = (steps: unknown): ProductTestStepLike | null => {
  const list = Array.isArray(steps) ? (steps as any[]) : [];
  const step = list.find((s: any) => s?.type === "product_test");
  return step ? { id: String(step.id), type: "product_test" } : null;
};

/**
 * Liefert den Produkttest-Schritt zurück, wenn dieser noch nicht abgeschlossen ist.
 * Gibt null zurück, wenn kein Produkttest existiert oder er bereits abgeschlossen ist.
 */
export const getPendingProductTestStep = async (
  taskId: string,
  steps: unknown
): Promise<ProductTestStepLike | null> => {
  const step = findProductTestStep(steps);
  if (!step) return null;

  const { data, error } = await supabase.functions.invoke("product-test", {
    body: { action: "status", task_id: taskId, step_id: step.id },
  });

  if (error) return step;
  return (data as any)?.participation?.status === "completed" ? null : step;
};
