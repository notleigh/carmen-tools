/**
 * The city model and the shape of city JSON files, as Zod schemas the types are
 * inferred from. Kept apart from cit.ts so code that only imports the types
 * (the web editor) doesn't pull Zod into its bundle.
 */

import { z } from "zod";
import { CitError, LOCATIONS, isStringResource, type Location } from "./cit.ts";

const u16 = z.int().min(0).max(0xffff);
const textList = z.array(z.string());
const listName = z.enum(["intro", "treasures", ...LOCATIONS] as const);

/** Names of the string lists that countOverrides can refer to. */
export type ListName = z.infer<typeof listName>;

/** Palette indices 0-3, one byte per pixel, row-major. Width is a multiple of 4. */
const citImageSchema = z.object({
  width: z.int().positive(),
  height: z.int().positive(),
  pixels: z.instanceof(Uint8Array),
});

export type CitImage = z.infer<typeof citImageSchema>;

/** A city as decodeCit returns it and encodeCit takes it. */
export const citySchema = z.strictObject({
  /** Name shown in the game. */
  name: z.string(),
  /** Position on the world map (existing cities use x 12-258, y 1-85). */
  mapX: u16,
  mapY: u16,
  image: citImageSchema,
  /** Sentences shown on arrival. */
  intro: textList,
  /** Treasures that can be stolen from this city. */
  treasures: textList,
  /**
   * What witnesses at each location say when the thief is heading here
   * (@1 = he/she, @2 = his/her). A location left out doesn't exist in this city.
   */
  clues: z.partialRecord(z.enum(LOCATIONS), textList),
  /**
   * Counts stored in the file when they differ from the list length
   * (ROME's intro says 2 but holds 3).
   */
  countOverrides: z.partialRecord(listName, u16).optional(),
  /** Resources this tool doesn't understand, keyed by id, as hex. */
  raw: z
    .record(
      z.string().regex(/^\d+$/, "key must be a resource id number"),
      z.string().regex(/^([0-9a-fA-F]{2})*$/, "must be a hex string"),
    )
    .optional(),
});

export type City = z.infer<typeof citySchema>;

/**
 * Shape of a city JSON file: a City with the image in a separate PNG. This
 * checks only types and what the file format can hold; whether the game copes
 * with the city is validateCity's job.
 */
export const cityJsonSchema = citySchema
  .extend({
    /** PNG file name, relative to this JSON file. */
    image: z.string().min(1, "must be a PNG file name"),
  })
  .superRefine((json, ctx) => {
    for (const key of Object.keys(json.countOverrides ?? {})) {
      if (key !== "intro" && key !== "treasures" && !json.clues[key as Location]) {
        ctx.addIssue({ code: "custom", path: ["countOverrides", key], message: "no list with this name" });
      }
    }
    for (const key of Object.keys(json.raw ?? {})) {
      const id = Number(key);
      if (id === 1 || id === 2 || id === 100 || isStringResource(id)) {
        ctx.addIssue({ code: "custom", path: ["raw", key], message: "id is handled by another field" });
      }
    }
  });

export type CityJson = z.infer<typeof cityJsonSchema>;

/** `clues.hotel[2]`-style path for a schema issue. */
function issuePath(path: readonly PropertyKey[]): string {
  return (
    path.reduce<string>((out, key) => {
      if (typeof key === "number") return `${out}[${key}]`;
      return out ? `${out}.${String(key)}` : String(key);
    }, "") || "file"
  );
}

/** Parse and check a JSON file, with errors that point at the offending fields. */
export function parseCityJson(source: string): CityJson {
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch (e) {
    throw new CitError(`invalid JSON: ${(e as Error).message}`);
  }
  const result = cityJsonSchema.safeParse(data);
  if (!result.success) {
    throw new CitError(result.error.issues.map((i) => `\n  ${issuePath(i.path)}: ${i.message}`).join(""));
  }
  return result.data;
}
