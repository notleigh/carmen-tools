/** Editable JSON form of a city; the image is a separate PNG next to it. */

import {
  CitError,
  INTRO,
  LOCATIONS,
  TREASURES,
  locationId,
  type CitImage,
  type City,
  type Section,
} from "./cit.ts";
import type { CityJson, ListName } from "./schema.ts";

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
