/** Keep live messages and loaded history in chronological order without duplicates. */
export function mergeMessages<T extends { id: string; created_at: string }>(history: T[], latest: T[]): T[] {
  const byId = new Map(history.map(message => [message.id, message]));
  for (const message of latest) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
