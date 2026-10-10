export async function deliverChatMessage(
  save: () => Promise<{ error: { message: string } | null }>,
  reply: () => Promise<{ data: { answer?: string | null } | null; error: { message: string } | null }>,
) {
  const saved = await save();
  if (saved.error) throw new Error(saved.error.message);
  try {
    const response = await reply();
    return { delivered: true, answer: response.data?.answer || null, replyError: response.error?.message || null };
  } catch (error) {
    return { delivered: true, answer: null, replyError: error instanceof Error ? error.message : "Automatische Antwort nicht verfügbar" };
  }
}