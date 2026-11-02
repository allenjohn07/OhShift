/**
 * Light text normalisation shared by the lexical router and keyword search:
 * lowercase, drop filler words, stem, and fold synonyms ("boss" → "leader").
 */

const STOP = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "do", "does", "did",
  "of", "to", "at", "and", "or", "it", "this", "that", "please", "you", "there",
  // request verbs carry no topic ("tell me a joke" must not look like "tell me the manager")
  "tell", "show", "give", "list", "get", "find", "name",
]);

/** Words that mean the same thing for routing purposes. */
const CANON: Record<string, string> = {
  boss: "leader", supervisor: "leader", charge: "leader", head: "leader",
  owner: "leader", founder: "leader", ceo: "leader", lead: "leader",
  leader: "leader", manager: "leader", manage: "leader", run: "leader",
  employee: "member", worker: "member", staff: "member", coworker: "member",
  teammate: "member", people: "member", everyone: "member",
};

function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  return CANON[w] ?? w;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\{name\}/g, " name ")
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

