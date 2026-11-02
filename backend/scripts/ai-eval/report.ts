// Reads the worker's JSON on stdin and prints accuracy + every miss.
export {};
type Row = { question: string; expected: string | null; got: string | null; via: string; top: { id: string; score: number }[]; ms: number };
const data = JSON.parse(await Bun.stdin.text()) as { thresholds: unknown; results: Row[] };
const rows = data.results;
const hit = rows.filter((r) => r.got === r.expected);
const answerable = rows.filter((r) => r.expected !== null);
const unanswerable = rows.filter((r) => r.expected === null);
const wrongIntent = answerable.filter((r) => r.got !== null && r.got !== r.expected);
const abstained = answerable.filter((r) => r.got === null);
const falsePositives = unanswerable.filter((r) => r.got !== null);
const pct = (n: number, d: number) => `${n}/${d} (${d ? Math.round((n / d) * 100) : 0}%)`;
console.log(`routing accuracy:        ${pct(hit.length, rows.length)}`);
console.log(`  wrong intent:          ${pct(wrongIntent.length, answerable.length)}`);
console.log(`  abstained (asks user): ${pct(abstained.length, answerable.length)}`);
console.log(`  forced on unanswerable:${pct(falsePositives.length, unanswerable.length)}`);
console.log(`  via:`, Object.fromEntries([...new Set(rows.map((r) => r.via))].map((v) => [v, rows.filter((r) => r.via === v).length])));
console.log(`  median latency: ${[...rows].sort((a, b) => a.ms - b.ms)[Math.floor(rows.length / 2)]?.ms}ms`);
for (const r of rows.filter((r) => r.got !== r.expected)) {
  console.log(`${r.got === null ? "ABSTAIN" : "WRONG  "} ${JSON.stringify(r.question)}  want=${r.expected} got=${r.got} [${r.via}]  ${r.top.map((t) => `${t.id}:${t.score}`).join(", ")}`);
}
