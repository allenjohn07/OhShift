/**
 * The assistant only reads data (and, for managers, drafts a shift proposal that
 * they confirm in the UI). Requests to *change* things are answered with where
 * to do it, instead of being matched to the nearest lookup (which would show
 * your shifts when you asked to delete one).
 */
const LEAD =
  "^\\s*(?:please\\s+)?(?:(?:can|could|would|will)\\s+you\\s+|i\\s+(?:want|need|would\\s+like)\\s+to\\s+|i'd\\s+like\\s+to\\s+|let\\s+me\\s+|how\\s+(?:do|can|could|should)\\s+i\\s+)?";

const ACTION = new RegExp(
  `${LEAD}(delete|remove|cancel|approve|deny|reject|edit|change|update|reset|swap|trade|submit|request|apply|send|email|text|message|clock\\s+(?:in|out)|punch\\s+(?:in|out))\\b`,
  "i",
);

export function unsupportedRequest(prompt: string): string | null {
  const m = ACTION.exec(prompt);
  if (!m) return null;
  const verb = m[1]!.toLowerCase().replace(/\s+/g, " ");
  const lower = prompt.toLowerCase();

  if (/\b(time[- ]?off|vacation|days? off|leave|pto)\b/.test(lower)) {
    return /\b(approve|deny|reject)\b/.test(verb)
      ? "I can't approve or deny requests. Managers do that on the Requests page."
      : "I can't submit requests. To ask for time off, open Time off and choose Request time off.";
  }
  if (/\b(approve|deny|reject)\b/.test(verb)) {
    return "I can't approve or deny things. Managers review timesheets on the Timesheets page and time off on the Requests page.";
  }
  if (/\bpassword\b/.test(lower)) {
    return "I can't change passwords. Open your Profile to update or reset your password.";
  }
  if (/^(clock|punch)/.test(verb)) {
    return "I can't clock you in or out. Use the clock button on your dashboard or the Hours page.";
  }
  if (/\bshifts?\b/.test(lower)) {
    return "I can't edit or delete shifts. Open the shift on the schedule and choose Edit or Delete.";
  }
  return "I can look things up, but I can't make changes. (Managers can ask me to draft a new shift, like “Put Priya on Friday morning”.)";
}
