/** Editable JSON form of a city; the picture is a separate PNG next to it. */

import {
  CitError,
  INTRO,
  LOCATIONS,
  TREASURES,
  isStringResource,
  locationId,
  type CitImage,
  type City,
  type Location,
  type Section,
} from "./cit.ts";

/** Names of the string lists that countOverrides can refer to. */
export type ListName = "intro" | "treasures" | Location;

export interface CityJson {
  /** Name shown in the game; it uses at most 20 characters. */
  name: string;
  /** Position on the world map (existing cities use x 12-258, y 1-80). */
  mapX: number;
  mapY: number;
  /** PNG file name, relative to this JSON file. */
  image: string;
  /** Sentences shown on arrival. */
  intro: string[];
  /** Treasures that can be stolen from this city. */
  treasures: string[];
  /**
   * What witnesses at each location say when the thief is heading here
   * (@1 = he/she, @2 = his/her). A location left out doesn't exist in this city.
   */
  clues: Partial<Record<Location, string[]>>;
  /**
   * Counts stored in the file when they differ from the list length
   * (ROME's intro says 2 but holds 3).
   */
  countOverrides?: Partial<Record<ListName, number>>;
  /** Resources this tool doesn't understand, keyed by id, as hex. */
  raw?: Record<string, string>;
}

const FIELDS = new Set(["name", "mapX", "mapY", "image", "intro", "treasures", "clues", "countOverrides", "raw"]);

function toHex(data: Uint8Array): string {
  return Array.from(data, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function cityToJson(city: City, imageName: string): CityJson {
  const json: CityJson = {
    name: city.name,
    mapX: city.mapX,
    mapY: city.mapY,
    image: imageName,
    intro: [],
    treasures: [],
    clues: {},
  };
  const counts: Partial<Record<ListName, number>> = {};
  const raw: Record<string, string> = {};
  const found = new Set<number>();
  for (const section of city.sections) {
    found.add(section.id);
    if (section.kind === "raw") {
      raw[section.id] = toHex(section.data);
      continue;
    }
    let key: ListName;
    if (section.id === INTRO) {
      key = "intro";
      json.intro = section.strings;
    } else if (section.id === TREASURES) {
      key = "treasures";
      json.treasures = section.strings;
    } else {
      const location = LOCATIONS[section.id - 101];
      json.clues[location] = section.strings;
      key = location;
    }
    if (section.count !== undefined) counts[key] = section.count;
  }
  if (!found.has(INTRO) || !found.has(TREASURES)) throw new CitError("file has no intro or treasure list");
  if (Object.keys(counts).length) json.countOverrides = counts;
  if (Object.keys(raw).length) json.raw = raw;
  return json;
}

export function jsonToCity(json: CityJson, image: CitImage): City {
  const list = (id: number, key: ListName, strings: string[]): Section => {
    const count = json.countOverrides?.[key];
    return count === undefined ? { kind: "strings", id, strings } : { kind: "strings", id, strings, count };
  };
  const sections: Section[] = [
    list(INTRO, "intro", json.intro),
    list(TREASURES, "treasures", json.treasures),
    ...LOCATIONS.flatMap((location) => {
      const strings = json.clues[location];
      return strings ? [list(locationId(location), location, strings)] : [];
    }),
    ...Object.entries(json.raw ?? {}).map(
      ([id, hex]): Section => ({
        kind: "raw",
        id: Number(id),
        data: Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16)),
      }),
    ),
  ];
  return {
    name: json.name,
    mapX: json.mapX,
    mapY: json.mapY,
    image,
    sections: sections.sort((a, b) => a.id - b.id),
  };
}

function fail(path: string, message: string): never {
  throw new CitError(`${path}: ${message}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string") fail(path, "must be a string");
  if (/[^\x20-\x7e]/.test(value)) fail(path, "must be printable ASCII; the game can't show other characters");
  return value;
}

function wholeNumber(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 0xffff) {
    fail(path, "must be a whole number from 0 to 65535");
  }
  return value as number;
}

function textList(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) fail(path, "must be a list of strings");
  return value.map((item, i) => text(item, `${path}[${i}]`));
}

function isLocation(key: string): key is Location {
  return (LOCATIONS as readonly string[]).includes(key);
}

function idKey(key: string, path: string): number {
  if (!/^\d+$/.test(key)) fail(path, "key must be a resource id number");
  return Number(key);
}

/** Parse and check a JSON file, with errors that point at the offending field. */
export function parseCityJson(source: string): CityJson {
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch (e) {
    throw new CitError(`invalid JSON: ${(e as Error).message}`);
  }
  if (!isObject(data)) fail("file", "must be a JSON object");
  for (const key of Object.keys(data)) if (!FIELDS.has(key)) fail(key, "unknown field");

  if (!isObject(data.clues)) fail("clues", "must be an object of clue lists");
  const clues: Partial<Record<Location, string[]>> = {};
  for (const [key, list] of Object.entries(data.clues)) {
    if (!isLocation(key)) fail(`clues.${key}`, `unknown location; use one of ${LOCATIONS.join(", ")}`);
    clues[key] = textList(list, `clues.${key}`);
  }

  const json: CityJson = {
    name: text(data.name, "name"),
    mapX: wholeNumber(data.mapX, "mapX"),
    mapY: wholeNumber(data.mapY, "mapY"),
    image: typeof data.image === "string" && data.image ? data.image : fail("image", "must be a PNG file name"),
    intro: textList(data.intro, "intro"),
    treasures: textList(data.treasures, "treasures"),
    clues,
  };

  if (data.countOverrides !== undefined) {
    if (!isObject(data.countOverrides)) fail("countOverrides", "must be an object");
    json.countOverrides = {};
    for (const [key, value] of Object.entries(data.countOverrides)) {
      const path = `countOverrides.${key}`;
      if (key !== "intro" && key !== "treasures" && !(isLocation(key) && clues[key])) {
        fail(path, "no list with this name");
      }
      json.countOverrides[key] = wholeNumber(value, path);
    }
  }

  if (data.raw !== undefined) {
    if (!isObject(data.raw)) fail("raw", "must be an object of hex strings");
    json.raw = {};
    for (const [key, value] of Object.entries(data.raw)) {
      const path = `raw.${key}`;
      const id = idKey(key, path);
      if (id === 1 || id === 2 || id === 100 || isStringResource(id)) fail(path, "id is handled by another field");
      if (typeof value !== "string" || !/^([0-9a-fA-F]{2})*$/.test(value)) fail(path, "must be a hex string");
      json.raw[key] = value;
    }
  }
  return json;
}
