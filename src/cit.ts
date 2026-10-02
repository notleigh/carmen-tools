/**
 * Reader and writer for Carmen Sandiego (1985, DOS) .CIT city files.
 * Pure functions over Uint8Array: no Node or DOM APIs, so this runs anywhere.
 *
 * .CIT layout (little-endian):
 *   u32 directory offset, u16 directory size, then resources, each followed by a
 *   1-byte checksum (sum of the resource's bytes & 0xFF). Directory: u16 0,
 *   u16 count, then count x (u16 id, u32 offset, u16 size).
 *
 * Resources:
 *   1        u16 map_y, u16 map_x, city name (NUL-terminated)
 *   2        u16 height, u16 width/2 (always 2 x bytes per row),
 *            u16 bytes per row, RLE 2bpp CGA pixels
 *   3, 4     string lists: intro sentences, stealable treasures
 *   100      u16 n, n x u16 - which clue resources (100+k) exist
 *   101-112  string lists, one per location type (101 = Bank ... 112 = Foreign
 *            Ministry, see LOCATIONS): what witnesses there say when the thief
 *            is heading to this city (@1 = he/she, @2 = his/her). Resource 100
 *            also decides which locations exist when you visit the city.
 *   String list = u16 count, then NUL-terminated strings.
 */

/** CGA palette 1, high intensity: black, light cyan, light magenta, white */
export const PALETTE: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [85, 255, 255],
  [255, 85, 255],
  [255, 255, 255],
];

/**
 * Location types, in game order: LOCATIONS[k - 1] is location k, whose clues are
 * resource 100 + k and whose icon is resource 100 + k in CARMEN.DAT.
 */
export const LOCATIONS = [
  "bank", "hotel", "museum", "sportClub", "library", "airport",
  "harbor", "riverfront", "palace", "stockExchange", "marketplace", "foreignMinistry",
] as const;

export type Location = (typeof LOCATIONS)[number];

export const locationId = (location: Location): number => 101 + LOCATIONS.indexOf(location);

export const INTRO = 3;
export const TREASURES = 4;
const HEADER = 1;
const IMAGE = 2;
const CLUE_INDEX = 100;

/** Palette indices 0-3, one byte per pixel, row-major. Width is a multiple of 4. */
export interface CitImage {
  width: number;
  height: number;
  pixels: Uint8Array;
}

export interface StringSection {
  kind: "strings";
  id: number;
  strings: string[];
  /** Stored count when it differs from strings.length (ROME's intro says 2 but holds 3). */
  count?: number;
}

/** A resource this tool doesn't understand, kept as-is. */
export interface RawSection {
  kind: "raw";
  id: number;
  data: Uint8Array;
}

export type Section = StringSection | RawSection;

export interface City {
  name: string;
  mapX: number;
  mapY: number;
  image: CitImage;
  /** Intro (3), treasures (4), location clues (101-112) and any unknown resources, in id order. */
  sections: Section[];
}

export class CitError extends Error {
  name = "CitError";
}

export function isStringResource(id: number): boolean {
  return id === INTRO || id === TREASURES || (id >= 101 && id <= 100 + LOCATIONS.length);
}

export function nearestColour(r: number, g: number, b: number): number {
  let best = 0;
  let bestDist = Infinity;
  PALETTE.forEach(([pr, pg, pb], i) => {
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  });
  return best;
}

function checksum(data: Uint8Array): number {
  let sum = 0;
  for (const b of data) sum += b;
  return sum & 0xff;
}

function decodeAscii(data: Uint8Array): string {
  let text = "";
  for (const b of data) text += String.fromCharCode(b);
  return text;
}

function encodeAscii(text: string, what: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 0) throw new CitError(`${what}: contains a NUL character, which would end the string early`);
    if (c > 0x7f) throw new CitError(`${what}: non-ASCII text; the game can only show plain ASCII`);
    out.push(c);
  }
  return out;
}

export function unrle(src: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i++];
    if (c < 0x80) {
      for (let k = 0; k <= c && i < src.length; k++) out.push(src[i++]);
    } else {
      const value = src[i++];
      for (let k = 0; k < 256 - c; k++) out.push(value);
    }
  }
  return Uint8Array.from(out);
}

/** Inverse of unrle; matches the original encoder byte-for-byte. */
export function rle(src: Uint8Array): Uint8Array {
  const out: number[] = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && src[j + 1] === src[i] && j - i < 127) j++;
    if (j > i) {
      out.push(256 - (j - i + 1), src[i]);
      i = j + 1;
    } else {
      while (j < n && !(j + 1 < n && src[j] === src[j + 1]) && j - i < 128) j++;
      out.push(j - i - 1, ...src.subarray(i, j));
      i = j;
    }
  }
  return Uint8Array.from(out);
}

function decodeImage(body: Uint8Array, warnings: string[]): CitImage {
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const height = view.getUint16(0, true);
  const stride = view.getUint16(4, true);
  let packed = unrle(body.subarray(6));
  if (packed.length !== height * stride) {
    warnings.push(`image decodes to ${packed.length} bytes, expected ${height * stride}`);
    const fixed = new Uint8Array(height * stride);
    fixed.set(packed.subarray(0, fixed.length));
    packed = fixed;
  }
  const pixels = new Uint8Array(stride * 4 * height);
  packed.forEach((b, i) => {
    pixels[i * 4] = (b >> 6) & 3;
    pixels[i * 4 + 1] = (b >> 4) & 3;
    pixels[i * 4 + 2] = (b >> 2) & 3;
    pixels[i * 4 + 3] = b & 3;
  });
  return { width: stride * 4, height, pixels };
}

function encodeImage(image: CitImage): Uint8Array {
  const { width, height, pixels } = image;
  if (width % 4) throw new CitError(`image width ${width} is not a multiple of 4`);
  if (pixels.length !== width * height) throw new CitError("image pixel count does not match its size");
  const packed = new Uint8Array(pixels.length / 4);
  for (let i = 0; i < packed.length; i++) {
    const p = pixels.subarray(i * 4, i * 4 + 4);
    if (p.some((v) => v > 3)) throw new CitError("image pixels must be palette indices 0-3");
    packed[i] = (p[0] << 6) | (p[1] << 4) | (p[2] << 2) | p[3];
  }
  const stride = width / 4;
  const header = new Uint8Array(6);
  const view = new DataView(header.buffer);
  view.setUint16(0, height, true);
  view.setUint16(2, stride * 2, true);
  view.setUint16(4, stride, true);
  return concat([header, rle(packed)]);
}

function decodeStrings(id: number, body: Uint8Array): StringSection {
  const count = body[0] | (body[1] << 8);
  const strings = decodeAscii(body.subarray(2)).split("\0");
  if (strings.length && strings[strings.length - 1] === "") strings.pop();
  const section: StringSection = { kind: "strings", id, strings };
  if (count !== strings.length) section.count = count;
  return section;
}

function encodeStrings(section: StringSection): Uint8Array {
  const count = section.count ?? section.strings.length;
  const out = [count & 0xff, count >> 8];
  section.strings.forEach((s, i) => out.push(...encodeAscii(s, `resource ${section.id} line ${i + 1}`), 0));
  return Uint8Array.from(out);
}

export function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

export function readCit(bytes: Uint8Array): { city: City; warnings: string[] } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const warnings: string[] = [];
  const dirOffset = view.getUint32(0, true);
  const dirSize = view.getUint16(4, true);
  const count = view.getUint16(dirOffset + 2, true);
  if (dirOffset + dirSize !== bytes.length || dirSize !== 4 + 8 * count) {
    warnings.push("directory size mismatch");
  }

  let header: Pick<City, "name" | "mapX" | "mapY"> | undefined;
  let image: CitImage | undefined;
  const sections: Section[] = [];
  for (let i = 0; i < count; i++) {
    const entry = dirOffset + 4 + 8 * i;
    const id = view.getUint16(entry, true);
    const offset = view.getUint32(entry + 2, true);
    const size = view.getUint16(entry + 6, true);
    const body = bytes.subarray(offset, offset + size);
    if (offset + size < bytes.length && bytes[offset + size] !== checksum(body)) {
      warnings.push(`bad checksum on resource ${id}`);
    }
    if (id === HEADER) {
      const end = body.indexOf(0, 4);
      header = {
        mapY: body[0] | (body[1] << 8),
        mapX: body[2] | (body[3] << 8),
        name: decodeAscii(body.subarray(4, end < 0 ? undefined : end)),
      };
    } else if (id === IMAGE) {
      image = decodeImage(body, warnings);
    } else if (id === CLUE_INDEX) {
      // Derivable from which clue sections exist; rebuilt by writeCit.
    } else if (isStringResource(id)) {
      sections.push(decodeStrings(id, body));
    } else {
      sections.push({ kind: "raw", id, data: body.slice() });
    }
  }
  if (!header || !image) throw new CitError("file has no city header or image");
  return { city: { ...header, image, sections }, warnings };
}

/**
 * Throws CitError only for what the file format can't hold. Whether the game
 * copes with the city is validateCity's job; call it first.
 */
export function writeCit(city: City): Uint8Array {
  const resources = new Map<number, Uint8Array>();
  resources.set(
    HEADER,
    Uint8Array.from([
      city.mapY & 0xff, city.mapY >> 8,
      city.mapX & 0xff, city.mapX >> 8,
      ...encodeAscii(city.name, "name"), 0,
    ]),
  );
  resources.set(IMAGE, encodeImage(city.image));
  for (const section of city.sections) {
    if (resources.has(section.id)) throw new CitError(`resource ${section.id} appears twice`);
    resources.set(section.id, section.kind === "raw" ? section.data : encodeStrings(section));
  }
  const clues = [...resources.keys()].filter((id) => id > CLUE_INDEX && isStringResource(id)).sort((a, b) => a - b);
  const index = new DataView(new ArrayBuffer(2 + 2 * clues.length));
  index.setUint16(0, clues.length, true);
  clues.forEach((id, i) => index.setUint16(2 + 2 * i, id - CLUE_INDEX, true));
  resources.set(CLUE_INDEX, new Uint8Array(index.buffer));

  const ids = [...resources.keys()].sort((a, b) => a - b);
  const body: Uint8Array[] = [];
  const directory = new DataView(new ArrayBuffer(4 + 8 * ids.length));
  directory.setUint16(2, ids.length, true);
  let offset = 6;
  ids.forEach((id, i) => {
    const data = resources.get(id)!;
    if (data.length > 0xffff) throw new CitError(`resource ${id} is too large (${data.length} bytes)`);
    directory.setUint16(4 + 8 * i, id, true);
    directory.setUint32(6 + 8 * i, offset, true);
    directory.setUint16(10 + 8 * i, data.length, true);
    body.push(data, Uint8Array.of(checksum(data)));
    offset += data.length + 1;
  });

  const header = new DataView(new ArrayBuffer(6));
  header.setUint32(0, offset, true);
  header.setUint16(4, directory.byteLength, true);
  return concat([new Uint8Array(header.buffer), ...body, new Uint8Array(directory.buffer)]);
}
