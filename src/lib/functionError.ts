// Function HTTP errors keep the response body in context, not in invoke's data.
export async function readFunctionError(error: unknown, data: unknown): Promise<{ message?: string; status?: number }> {
  const payload = data && typeof data === "object" ? data as Record<string, unknown> : undefined;
  if (typeof payload?.error === "string") return { message: payload.error };
  const context = error && typeof error === "object" && "context" in error ? error.context : undefined;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      const message = typeof body?.error === "string" ? body.error : typeof body?.message === "string" ? body.message : undefined;
      return { message, status: context.status };
    } catch {
      return { status: context.status };
    }
  }
  return {};
}