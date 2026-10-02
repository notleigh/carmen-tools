import assert from "node:assert/strict";
import { test } from "node:test";
import { blankDraft, draftToJson, editList, listLines, type Draft } from "../web/draft.ts";

function filled(): Draft {
  const draft = blankDraft();
  return {
    ...draft,
    name: "Rome",
    mapX: "202",
    mapY: "23",
    lists: { ...draft.lists, intro: "One.\nTwo.\nThree.", treasures: "a ring", bank: "@1 changed @2 money." },
    countOverrides: { intro: 2 },
  };
}

test("blank lines are skipped but keep their line numbers", () => {
  assert.deepEqual(listLines("a\n\n  \nb\r\n"), [
    { text: "a", line: 0 },
    { text: "b", line: 3 },
  ]);
});

test("an empty location is left out of the city", () => {
  const json = draftToJson(filled());
  assert.deepEqual(Object.keys(json.clues), ["bank"]);
  assert.deepEqual(json.clues.bank, ["@1 changed @2 money."]);
});

test("empty number fields become NaN so validation flags them", () => {
  const json = draftToJson(blankDraft());
  assert.ok(Number.isNaN(json.mapX) && Number.isNaN(json.mapY));
});

test("editing a list drops only that list's count override", () => {
  const draft = filled();
  assert.deepEqual(draftToJson(editList(draft, "treasures", "a ring\na hat")).countOverrides, { intro: 2 });
  assert.equal(draftToJson(editList(draft, "intro", "One.\nTwo.")).countOverrides, undefined);
});
