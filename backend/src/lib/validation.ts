export type Rule = (value: unknown) => boolean;
export const text = (max: number, min = 0): Rule => value => typeof value === "string" && value.length <= max && value.trim().length >= min;
export const oneOf = (...values: string[]): Rule => value => typeof value === "string" && values.includes(value);
export const nullable = (rule: Rule): Rule => value => value === null || rule(value);
export const integer = (min: number, max: number): Rule => value => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
export const boolean: Rule = value => typeof value === "boolean";
export const email: Rule = value => text(254, 3)(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value as string).trim());
export const time: Rule = value => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export const dateOnly: Rule = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T00:00:00Z`).getTime()) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
export const instant: Rule = value => typeof value === "string" && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && dateOnly(value.slice(0, 10)) && Number.isFinite(new Date(value).getTime());
export const timezone: Rule = value => {
  if (typeof value !== "string" || value.length > 100) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
};
export const httpsUrl: Rule = value => {
  if (!text(2048, 1)(value)) return false;
  try { const url = new URL(value as string); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
};
export function object(fields: Record<string, Rule>, required: string[] = []): Rule {
  return value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const row = value as Record<string, unknown>;
    return required.every(key => row[key] !== undefined) && Object.entries(fields).every(([key, rule]) => row[key] === undefined || rule(row[key]));
  };
}
export const array = (rule: Rule, min: number, max: number): Rule => value => Array.isArray(value) && value.length >= min && value.length <= max && value.every(rule);
