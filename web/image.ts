/** Turning any image the browser can open into a city picture. */

import { IMAGE_HEIGHT, IMAGE_WIDTH, rgbaToImage, type CitImage } from "../src/index.ts";

/** CGA pixels are 1.2x taller than wide (320x200 shown on a 4:3 screen). */
export const PIXEL_ASPECT = 1.2;

/**
 * A 136x164 image keeps its pixels exactly; anything else is cropped to fill the
 * picture's on-screen shape, centred, and scaled. Either way every pixel snaps to
 * the nearest CGA colour.
 */
export async function imageFromFile(file: File): Promise<CitImage> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  if (bitmap.width === IMAGE_WIDTH && bitmap.height === IMAGE_HEIGHT) {
    ctx.drawImage(bitmap, 0, 0);
  } else {
    const shape = IMAGE_WIDTH / (IMAGE_HEIGHT * PIXEL_ASPECT);
    let sw = bitmap.width;
    let sh = bitmap.height;
    if (sw / sh > shape) sw = sh * shape;
    else sh = sw / shape;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  }
  bitmap.close();
  return rgbaToImage(IMAGE_WIDTH, IMAGE_HEIGHT, ctx.getImageData(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT).data);
}
