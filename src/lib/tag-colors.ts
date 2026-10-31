/**
 * Notion-style tag colors (soft fill + readable text) for people/shift chips.
 * The same name always maps to the same color.
 */
const TAG_COLORS = [
  "bg-[#d3e5ef] text-[#183347] dark:bg-[#1f3a52] dark:text-[#b9dcf3]", // blue
  "bg-[#dbeddb] text-[#1c3829] dark:bg-[#1f3b2b] dark:text-[#b7e0c2]", // green
  "bg-[#e8deee] text-[#412454] dark:bg-[#3a2a4a] dark:text-[#ddc7f0]", // purple
  "bg-[#fdecc8] text-[#402c1b] dark:bg-[#4a3a1a] dark:text-[#f2d9a4]", // yellow
  "bg-[#fadec9] text-[#49290e] dark:bg-[#4d2f1a] dark:text-[#f5c8a4]", // orange
  "bg-[#f5e0e9] text-[#4c2337] dark:bg-[#4a2539] dark:text-[#f2c4da]", // pink
  "bg-[#eee0da] text-[#442a1e] dark:bg-[#3f2c24] dark:text-[#e6cbbd]", // brown
] as const;

export function getEmployeeColor(name: string = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}
