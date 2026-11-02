import { expect, test } from "bun:test";
import { mergeMessages } from "../src/lib/messages";
test("loaded history survives live updates and overlapping messages appear once", () => {
  const old = { id: "a", created_at: "2035-01-01T09:00:00Z", body: "Old" };
  const overlap = { id: "b", created_at: "2035-01-01T10:00:00Z", body: "Original" };
  const fresh = { id: "c", created_at: "2035-01-01T11:00:00Z", body: "New" };
  expect(mergeMessages([old, overlap], [{ ...overlap, body: "Latest" }, fresh])).toEqual([old, { ...overlap, body: "Latest" }, fresh]);
});
