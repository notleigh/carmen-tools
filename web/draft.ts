/**
 * The editor's form state and its conversions to and from .CIT bytes.
 * No DOM here, so the tests can run it in Node.
 */

import {
  IMAGE_HEIGHT,
  IMAGE_WIDTH,
  LOCATIONS,
  decodeCit,
  encodeCit,
  validateCity,
  type City,
  type Field,
  type ListName,
} from "../src/index.ts";

export const LISTS: readonly ListName[] = ["intro", "treasures", ...LOCATIONS];

/** Form contents: number fields stay text so they can be empty, lists are one string per text box. */
export type Draft = Omit<City, "mapX" | "mapY" | "intro" | "treasures" | "clues"> & {
  mapX: string;
  mapY: string;
  lists: Record<ListName, string>;
};

function emptyLists(): Record<ListName, string> {
  return Object.fromEntries(LISTS.map((key) => [key, ""])) as Record<ListName, string>;
}

export function blankDraft(): Draft {
  return {
    name: "",
    mapX: "",
    mapY: "",
    image: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT, pixels: new Uint8Array(IMAGE_WIDTH * IMAGE_HEIGHT) },
    lists: emptyLists(),
  };
}

export function draftFromCity(city: City): Draft {
  const { mapX, mapY, intro, treasures, clues, ...rest } = city;
  const lists = emptyLists();
  lists.intro = intro.join("\n");
  lists.treasures = treasures.join("\n");
  for (const location of LOCATIONS) lists[location] = (clues[location] ?? []).join("\n");
  return { ...rest, mapX: String(mapX), mapY: String(mapY), lists };
}

/** The strings in a text box, with the 0-based line each came from; blank lines are skipped. */
export function listLines(text: string): { text: string; line: number }[] {
  return text
    .split("\n")
    .map((line, i) => ({ text: line.replace(/\r$/, ""), line: i }))
    .filter((l) => l.text.trim() !== "");
}

/** Editing a list drops its count override, so the saved count matches what's on screen. */
export function editList(draft: Draft, key: ListName, text: string): Draft {
  const { [key]: _, ...countOverrides } = draft.countOverrides ?? {};
  return {
    ...draft,
    lists: { ...draft.lists, [key]: text },
    countOverrides: Object.keys(countOverrides).length ? countOverrides : undefined,
  };
}

const toNumber = (text: string): number => (text.trim() === "" ? NaN : Number(text));

/** A location whose text box is empty is left out of the city. */
export function draftToCity(draft: Draft): City {
  const { mapX, mapY, lists, ...rest } = draft;
  const strings = (key: ListName) => listLines(lists[key]).map((l) => l.text);
  const clues: City["clues"] = {};
  for (const location of LOCATIONS) {
    const list = strings(location);
    if (list.length) clues[location] = list;
  }
  return {
    ...rest,
    mapX: toNumber(mapX),
    mapY: toNumber(mapY),
    intro: strings("intro"),
    treasures: strings("treasures"),
    clues,
  };
}

/** How the form names a field: "sportClub" -> "Sport club". */
export function label(field: Field): string {
  return field.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`).replace(/^./, (c) => c.toUpperCase());
}

/** A broken game rule, located on the form and worded for the checklist. */
export interface DraftProblem {
  field: Field;
  /** 0-based line in the field's text box, for a problem with one string. */
  line?: number;
  text: string;
}

export function draftProblems(draft: Draft): DraftProblem[] {
  return validateCity(draftToCity(draft)).map(({ field, index, message }) => {
    const line = index === undefined ? undefined : listLines(draft.lists[field as ListName])[index].line;
    // The locations message names its own subject ("only 7 locations have clues").
    const where = field === "locations" ? "" : `${label(field)}${line === undefined ? "" : ` line ${line + 1}`} `;
    const text = (where + message).replace(/^./, (c) => c.toUpperCase());
    return line === undefined ? { field, text } : { field, line, text };
  });
}

/** Throws CitError (or RangeError for a truncated file) when the bytes aren't a usable city. */
export function loadCit(bytes: Uint8Array): { draft: Draft; warnings: string[] } {
  const { city, warnings } = decodeCit(bytes);
  return { draft: draftFromCity(city), warnings };
}

export function saveCit(draft: Draft): Uint8Array {
  return encodeCit(draftToCity(draft));
}
