/**
 * Command-line extract/pack between .CIT files and CITY.json + CITY.png.
 *
 *   node src/cli.ts extract [-o OUTDIR] FILE.CIT [FILE.CIT ...]     (default OUTDIR: extracted-json)
 *   node src/cli.ts pack    [-o OUTDIR] CITY.json [CITY.json ...]   (default OUTDIR: packed)
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import {
  CitError,
  cityToJson,
  decodePng,
  encodePng,
  jsonToCity,
  parseCityJson,
  problemPath,
  readCit,
  validateCity,
  writeCit,
} from "./index.ts";

const stem = (path: string) => basename(path, extname(path));

async function extract(path: string, outDir: string): Promise<string[]> {
  const { city, warnings } = readCit(await readFile(path));
  const pngName = `${stem(path)}.png`;
  await writeFile(join(outDir, pngName), await encodePng(city.image));
  await writeFile(join(outDir, `${stem(path)}.json`), JSON.stringify(cityToJson(city, pngName), null, 2) + "\n");
  return warnings;
}

async function pack(path: string, outDir: string): Promise<string[]> {
  const json = parseCityJson(await readFile(path, "utf8"));
  const problems = validateCity(json);
  if (problems.length) {
    throw new CitError(problems.map((p) => `\n  ${problemPath(p)}: ${p.message}`).join(""));
  }
  const image = await decodePng(await readFile(join(dirname(path), json.image)));
  const { bytes, warnings } = writeCit(jsonToCity(json, image));
  await writeFile(join(outDir, `${stem(path)}.CIT`), bytes);
  return warnings;
}

async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);
  const commands = { extract: [extract, "extracted-json"], pack: [pack, "packed"] } as const;
  if (command !== "extract" && command !== "pack") {
    console.error("usage: node src/cli.ts extract|pack [-o OUTDIR] FILE [FILE ...]");
    return 2;
  }
  const [run, defaultOut] = commands[command];
  let outDir: string = defaultOut;
  const oIndex = args.findIndex((a) => a === "-o" || a === "--out");
  if (oIndex >= 0) [, outDir] = args.splice(oIndex, 2);
  if (!args.length || !outDir) {
    console.error(`usage: node src/cli.ts ${command} [-o OUTDIR] FILE [FILE ...]`);
    return 2;
  }

  await mkdir(outDir, { recursive: true });
  let failed = false;
  for (const path of args) {
    try {
      for (const warning of await run(path, outDir)) console.error(`warning: ${path}: ${warning}`);
      console.log(`${path} -> ${outDir}/`);
    } catch (e) {
      if (!(e instanceof CitError || (e instanceof Error && "code" in e) || e instanceof RangeError)) throw e;
      console.error(`error: ${path}: ${e.message}`);
      failed = true;
    }
  }
  return failed ? 1 : 0;
}

process.exitCode = await main();
