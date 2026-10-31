/** Merge a history response with live events received while it was in flight. */
export function mergeChatMessages<T extends { id: string; conversacion_id: string; creado_en: string }>(history: T[], live: T[], conversationId: string): T[] {
  const merged = new Map<string, T>()
  for (const message of history) if (message.conversacion_id === conversationId) merged.set(message.id, message)
  for (const message of live) if (message.conversacion_id === conversationId && !merged.has(message.id)) merged.set(message.id, message)
  return Array.from(merged.values()).sort((a, b) => a.creado_en.localeCompare(b.creado_en) || a.id.localeCompare(b.id))
}
