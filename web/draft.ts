/**
 * The editor's form state and its conversions to and from .CIT bytes.
 * No DOM here, so the tests can run it in Node.
 */

import {
  IMAGE_HEIGHT,
  IMAGE_WIDTH,
  LOCATIONS,
  cityToJson,
  jsonToCity,
  readCit,
  writeCit,
  type CitImage,
  type CityJson,
  type ListName,
} from "../src/index.ts";

export const LISTS: readonly ListName[] = ["intro", "treasures", ...LOCATIONS];

/** Form contents: number fields stay text so they can be empty, lists are one string per line. */
export interface Draft {
  name: string;
  mapX: string;
  mapY: string;
  image: CitImage;
  lists: Record<ListName, string>;
  countOverrides: Partial<Record<ListName, number>>;
  raw: Record<string, string>;
}

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
    countOverrides: {},
    raw: {},
  };
}

export function draftFromJson(json: CityJson, image: CitImage): Draft {
  const lists = emptyLists();
  lists.intro = json.intro.join("\n");
  lists.treasures = json.treasures.join("\n");
  for (const location of LOCATIONS) lists[location] = (json.clues[location] ?? []).join("\n");
  return {
    name: json.name,
    mapX: String(json.mapX),
    mapY: String(json.mapY),
    image,
    lists,
    countOverrides: { ...json.countOverrides },
    raw: { ...json.raw },
  };
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
  const { [key]: _, ...countOverrides } = draft.countOverrides;
  return { ...draft, lists: { ...draft.lists, [key]: text }, countOverrides };
}

const toNumber = (text: string): number => (text.trim() === "" ? NaN : Number(text));

/** A location whose text box is empty is left out of the city. */
export function draftToJson(draft: Draft): CityJson {
  const strings = (key: ListName) => listLines(draft.lists[key]).map((l) => l.text);
  const clues: CityJson["clues"] = {};
  for (const location of LOCATIONS) {
    const list = strings(location);
    if (list.length) clues[location] = list;
  }
  const json: CityJson = {
    name: draft.name,
    mapX: toNumber(draft.mapX),
    mapY: toNumber(draft.mapY),
    image: "",
    intro: strings("intro"),
    treasures: strings("treasures"),
    clues,
  };
  if (Object.keys(draft.countOverrides).length) json.countOverrides = draft.countOverrides;
  if (Object.keys(draft.raw).length) json.raw = draft.raw;
  return json;
}

/** Throws CitError (or RangeError for a truncated file) when the bytes aren't a usable city. */
export function loadCit(bytes: Uint8Array): { draft: Draft; warnings: string[] } {
  const { city, warnings } = readCit(bytes);
  return { draft: draftFromJson(cityToJson(city, ""), city.image), warnings };
}

export function saveCit(draft: Draft): Uint8Array {
  return writeCit(jsonToCity(draftToJson(draft), draft.image));
}
