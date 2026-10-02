/**
 * Checks against the real game files, which can't be committed. Point CARMEN_DIR
 * at a folder holding the .CIT files to run them:
 *
 *   CARMEN_DIR=~/games/carmen npm test
 */

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { problemPath, validateCity } from "../src/index.ts";
import { draftToJson, loadCit, saveCit } from "../web/draft.ts";

const dir = process.env.CARMEN_DIR;
const files = dir ? (await readdir(dir)).filter((f) => /\.cit$/i.test(f)) : [];

test("CARMEN_DIR holds .CIT files", { skip: !dir && "CARMEN_DIR not set" }, () => {
  assert.ok(files.length, `no .CIT files in ${dir}`);
});

for (const file of files) {
  test(`${file}: loads, passes validation and saves back byte-for-byte`, async () => {
    const bytes = new Uint8Array(await readFile(join(dir!, file)));
    const { draft, warnings } = loadCit(bytes);
    assert.deepEqual(warnings, []);
    assert.deepEqual(validateCity(draftToJson(draft)).map((p) => `${problemPath(p)}: ${p.message}`), []);
    assert.deepEqual(saveCit(draft), bytes);
  });
}
