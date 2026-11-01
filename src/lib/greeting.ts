/** "Good morning, Alex" — first name only, based on the local hour. */
export function greeting(fullName: string, now = new Date()) {
  const hour = now.getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const first = fullName.trim().split(/\s+/)[0];
  return first ? `Good ${part}, ${first}` : `Good ${part}`;
}

/** "Saturday, October 31" */
export function todayLabel(now = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
}
