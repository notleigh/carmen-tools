/**
 * Conversions between CitImage and PNG files or canvas RGBA data.
 * Uses only CompressionStream/DecompressionStream, available in browsers and Node 18+.
 */

import { CitError, PALETTE, concat, nearestColour } from "./cit.ts";
import type { CitImage } from "./schema.ts";

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function transform(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const piped = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** 8-bit indexed PNG with the CGA palette, one byte per pixel. */
export async function encodePng(image: CitImage): Promise<Uint8Array> {
  const { width, height, pixels } = image;
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr.set([8, 3, 0, 0, 0], 8); // bit depth 8, colour type 3 (indexed), no interlace

  const raw = new Uint8Array((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw.set(pixels.subarray(y * width, (y + 1) * width), y * (width + 1) + 1); // filter byte 0
  }
  return concat([
    Uint8Array.from(SIGNATURE),
    chunk("IHDR", ihdr),
    chunk("PLTE", Uint8Array.from(PALETTE.flat())),
    chunk("IDAT", await transform(raw, new CompressionStream("deflate"))),
    chunk("IEND", new Uint8Array()),
  ]);
}

/**
 * Any non-interlaced PNG; each pixel becomes the nearest CGA palette colour,
 * so an editor that re-saves as RGB or reorders the palette still works.
 */
export async function decodePng(bytes: Uint8Array): Promise<CitImage> {
  if (SIGNATURE.some((b, i) => bytes[i] !== b)) throw new CitError("not a PNG file");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0, depth = 0, colourType = 0, interlace = 0;
  let palette: number[][] = [];
  const idat: Uint8Array[] = [];
  for (let pos = 8; pos + 8 <= bytes.length; ) {
    const length = view.getUint32(pos);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    const body = bytes.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      const h = new DataView(body.buffer, body.byteOffset, body.byteLength);
      [width, height, depth, colourType, interlace] = [h.getUint32(0), h.getUint32(4), body[8], body[9], body[12]];
    } else if (type === "PLTE") {
      palette = Array.from({ length: body.length / 3 }, (_, i) => [...body.subarray(i * 3, i * 3 + 3)]);
    } else if (type === "IDAT") {
      idat.push(body);
    }
    pos += 12 + length;
  }
  if (interlace) throw new CitError("interlaced PNGs are not supported; save without interlacing");
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colourType];
  if (!channels) throw new CitError(`unsupported PNG colour type ${colourType}`);

  const raw = await transform(concat(idat), new DecompressionStream("deflate"));

  const bpp = Math.max(1, (channels * depth) >> 3);
  const stride = Math.ceil((width * channels * depth) / 8);
  const scale = 255 / ((1 << depth) - 1);
  const pixels = new Uint8Array(width * height);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let predictor = 0;
      if (filter === 1) predictor = a;
      else if (filter === 2) predictor = b;
      else if (filter === 3) predictor = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      row[i] = (row[i] + predictor) & 0xff;
    }
    prev = row;

    const sample = (n: number): number => {
      if (depth === 8) return row[n];
      if (depth === 16) return (row[n * 2] << 8) | row[n * 2 + 1];
      const perByte = 8 / depth;
      return (row[Math.floor(n / perByte)] >> (8 - depth * ((n % perByte) + 1))) & ((1 << depth) - 1);
    };
    for (let x = 0; x < width; x++) {
      let rgb: number[];
      if (colourType === 3) {
        rgb = palette[sample(x)] ?? [0, 0, 0];
      } else if (colourType === 0 || colourType === 4) {
        const v = Math.round(sample(x * channels) * scale);
        rgb = [v, v, v];
      } else {
        rgb = [0, 1, 2].map((k) => Math.round(sample(x * channels + k) * scale));
      }
      pixels[y * width + x] = nearestColour(rgb[0], rgb[1], rgb[2]);
    }
  }
  return { width, height, pixels };
}

/** RGBA bytes for a canvas: `new ImageData(imageToRgba(img), img.width, img.height)`. */
export function imageToRgba(image: CitImage): Uint8ClampedArray<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(image.pixels.length * 4);
  image.pixels.forEach((p, i) => {
    rgba.set(PALETTE[p], i * 4);
    rgba[i * 4 + 3] = 255;
  });
  return rgba;
}

/** From canvas RGBA data (e.g. `ctx.getImageData(...).data`), snapping to the palette. */
export function rgbaToImage(width: number, height: number, rgba: ArrayLike<number>): CitImage {
  const pixels = new Uint8Array(width * height);
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = nearestColour(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
  }
  return { width, height, pixels };
}
