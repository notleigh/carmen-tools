/**
 * Rules a city must pass before it is written. Every problem blocks saving, in
 * the web editor and in `cli.ts pack` alike.
 */

import { LOCATIONS, MAX_NAME, MIN_LOCATIONS, type Location } from "./cit.ts";
import type { CityJson, ListName } from "./json.ts";

/** Longest string allowed in any list: the longest one the original game ships (BAMAKO). */
export const MAX_STRING = 160;

/** Size of the world map (CARMEN.DAT resource 1002); mapX/mapY are pixels on it. */
export const MAP_WIDTH = 264;
export const MAP_HEIGHT = 95;

export type Field = "name" | "mapX" | "mapY" | "locations" | ListName;

export interface Problem {
  field: Field;
  /** Index into the field's string list, when the problem is with one string. */
  index?: number;
  message: string;
}

/** `clues.hotel[2]`-style path, matching the JSON layout. */
export function problemPath({ field, index }: Problem): string {
  const base = (LOCATIONS as readonly string[]).includes(field) ? `clues.${field}` : field;
  return index === undefined ? base : `${base}[${index}]`;
}

const NON_PRINTABLE = /[^\x20-\x7e]/;

function checkText(text: string, placeholders: boolean): string | undefined {
  if (NON_PRINTABLE.test(text)) return "must be plain ASCII; the game can't show other characters";
  if (placeholders) {
    if (/@(?![12])/.test(text)) return "has an @ that isn't @1 (he/she) or @2 (his/her)";
  } else if (text.includes("@")) {
    return "has an @, which only clues replace; it would show as-is";
  }
}

function checkCoordinate(value: number, size: number): string | undefined {
  if (!Number.isInteger(value) || value < 0 || value >= size) {
    return `must be a whole number from 0 to ${size - 1}`;
  }
}

export function validateCity(json: CityJson): Problem[] {
  const problems: Problem[] = [];
  const add = (field: Field, message: string | undefined, index?: number) => {
    if (message) problems.push(index === undefined ? { field, message } : { field, index, message });
  };

  if (!json.name) add("name", "is required");
  else if (json.name.length > MAX_NAME) add("name", `must be at most ${MAX_NAME} characters (the game cuts off the rest)`);
  else add("name", checkText(json.name, false));

  add("mapX", checkCoordinate(json.mapX, MAP_WIDTH));
  add("mapY", checkCoordinate(json.mapY, MAP_HEIGHT));

  const checkList = (field: ListName, strings: string[], placeholders: boolean) => {
    strings.forEach((text, i) => {
      if (!text.trim()) add(field, "is blank", i);
      else if (text.length > MAX_STRING) add(field, `is ${text.length} characters; the limit is ${MAX_STRING}`, i);
      else add(field, checkText(text, placeholders), i);
    });
  };

  if (!json.intro.length) add("intro", "needs at least one sentence");
  checkList("intro", json.intro, false);
  if (!json.treasures.length) add("treasures", "needs at least one treasure");
  checkList("treasures", json.treasures, false);

  const used = LOCATIONS.filter((location: Location) => json.clues[location]);
  for (const location of used) {
    const clues = json.clues[location]!;
    if (!clues.length) add(location, "has no clues; leave it out to disable the location");
    checkList(location, clues, true);
  }
  if (used.length < MIN_LOCATIONS) {
    add("locations", `only ${used.length} locations have clues; at least ${MIN_LOCATIONS} are needed or the game may hang`);
  }
  return problems;
}

/**
 * DOS file name for a city: "Rio de Janeiro" -> "RIODEJAN.CIT", the way the
 * original files are named.
 */
export function cityFileName(name: string): string {
  const stem = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return `${stem || "CITY"}.CIT`;
}
