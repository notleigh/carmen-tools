import assert from "node:assert/strict";
import { test } from "node:test";
import { blankDraft, draftProblems, draftToJson, editList, label, listLines, type Draft } from "../web/draft.ts";

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

function valid(): Draft {
  const draft = filled();
  const clues = Object.fromEntries(["bank", "hotel", "museum", "sportClub", "library", "airport", "harbor", "palace"].map((l) => [l, "@1 left."]));
  return { ...draft, lists: { ...draft.lists, ...clues } };
}

test("a complete draft has no problems", () => {
  assert.deepEqual(draftProblems(valid()), []);
});

test("list problems point at the text box line, counting blank lines", () => {
  const draft = editList(valid(), "sportClub", "fine\n\n\n" + "x".repeat(161) + "\n@3 went");
  assert.deepEqual(draftProblems(draft), [
    { field: "sportClub", line: 3, text: "Sport club line 4 is 161 characters; the limit is 160" },
    { field: "sportClub", line: 4, text: "Sport club line 5 has an @ that isn't @1 (he/she) or @2 (his/her)" },
  ]);
});

test("whole-field problems have no line", () => {
  const draft = { ...editList(valid(), "palace", ""), name: "", image: { width: 4, height: 4, pixels: new Uint8Array(16) } };
  assert.deepEqual(draftProblems(draft), [
    { field: "name", text: "Name is required" },
    { field: "image", text: "Image is 4×4; it must be 136×164" },
    { field: "locations", text: "Only 7 locations have clues; at least 8 are needed or the game may hang" },
  ]);
});

test("labels", () => {
  assert.equal(label("foreignMinistry"), "Foreign ministry");
  assert.equal(label("mapX"), "Map x");
  assert.equal(label("intro"), "Intro");
});
