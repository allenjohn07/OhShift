import { expect, test } from "bun:test";
import { nextQuest, QUESTS, roleForQuest, tourProgress } from "../src/features/demo/quests";
import { parseProgress } from "../src/features/demo/tour-store";

test("the tour walks quests in order and finishes when every quest is done", () => {
  expect(nextQuest(new Set())?.id).toBe(QUESTS[0].id);
  expect(nextQuest(new Set([QUESTS[0].id]))?.id).toBe(QUESTS[1].id);
  // Doing a later quest early doesn't skip the earlier ones.
  expect(nextQuest(new Set([QUESTS[3].id]))?.id).toBe(QUESTS[0].id);

  const all = new Set(QUESTS.map((q) => q.id));
  expect(nextQuest(all)).toBeNull();
  expect(tourProgress(all)).toEqual({ completed: QUESTS.length, total: QUESTS.length, finished: true });
  expect(tourProgress(new Set(["assign", "not-a-quest"]))).toEqual({ completed: 1, total: QUESTS.length, finished: false });
});

test("quests switch role only when the current one can't do them", () => {
  const promote = QUESTS.find((q) => q.id === "promote")!;
  const clockIn = QUESTS.find((q) => q.id === "clock-in")!;
  const review = QUESTS.find((q) => q.id === "review-time-off")!;
  expect(roleForQuest(promote, "manager")).toBe("owner");
  expect(roleForQuest(clockIn, "owner")).toBe("employee");
  expect(roleForQuest(review, "owner")).toBe("owner");
  expect(roleForQuest(review, "employee")).toBe("manager");
});

test("stored progress tolerates corrupt or stale data", () => {
  expect([...parseProgress(null)]).toEqual([]);
  expect([...parseProgress("not json")]).toEqual([]);
  expect([...parseProgress('{"assign":true}')]).toEqual([]);
  expect([...parseProgress('["assign", 3, "removed-quest", "publish"]')]).toEqual(["assign", "publish"]);
});

test("every quest has a unique id and a role that can do it", () => {
  expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
  for (const quest of QUESTS) expect(quest.roles.length).toBeGreaterThan(0);
});
