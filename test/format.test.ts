import assert from "node:assert/strict";
import { test } from "node:test";
import { CitError, INTRO, TREASURES, parseCityJson, writeCit, type City } from "../src/index.ts";

const valid = {
  name: "Lolly World",
  mapX: 52,
  mapY: 85,
  image: "LOLLYWOR.png",
  intro: ["Welcome."],
  treasures: ["a lolly"],
  clues: { bank: ["@1 changed @2 money."] },
};

const parse = (data: object) => parseCityJson(JSON.stringify({ ...valid, ...data }));

function parseError(data: object): string {
  try {
    parse(data);
  } catch (e) {
    assert.ok(e instanceof CitError);
    return e.message;
  }
  assert.fail("expected a CitError");
}

test("a well-formed file parses", () => {
  assert.deepEqual(parse({}), valid);
});

test("game rules are left to validateCity", () => {
  // Non-ASCII, an over-long name and too few locations are all well-formed JSON.
  assert.equal(parse({ name: "Malmö is far too long a name" }).name, "Malmö is far too long a name");
});

test("errors name every offending field", () => {
  const message = parseError({ mapX: 70000, intro: ["ok", 3], clues: { pub: [] }, extra: 1 });
  assert.match(message, /\n  mapX: /);
  assert.match(message, /\n  intro\[1\]: /);
  assert.match(message, /\n  clues: Unrecognized key: "pub"/);
  assert.match(message, /\n  file: Unrecognized key: "extra"/);
});

test("count overrides must name an existing list; raw ids can't clash", () => {
  assert.match(parseError({ countOverrides: { hotel: 2 } }), /countOverrides\.hotel: no list with this name/);
  assert.deepEqual(parse({ countOverrides: { intro: 2, bank: 1 } }).countOverrides, { intro: 2, bank: 1 });
  assert.match(parseError({ raw: { "103": "00" } }), /raw\.103: id is handled by another field/);
  assert.match(parseError({ raw: { "7": "0g" } }), /raw\.7: must be a hex string/);
});

test("invalid JSON is a CitError", () => {
  assert.throws(() => parseCityJson("{"), CitError);
});

function city(text: string): City {
  return {
    name: "X",
    mapX: 0,
    mapY: 0,
    image: { width: 4, height: 1, pixels: new Uint8Array(4) },
    sections: [
      { kind: "strings", id: INTRO, strings: [text] },
      { kind: "strings", id: TREASURES, strings: ["a lolly"] },
    ],
  };
}

test("writeCit throws only on what the format can't hold", () => {
  assert.ok(writeCit(city("fine")) instanceof Uint8Array);
  assert.throws(() => writeCit(city("a\0b")), /NUL/);
  assert.throws(() => writeCit(city("café")), /non-ASCII/);
  assert.throws(() => writeCit({ ...city("ok"), image: { width: 6, height: 1, pixels: new Uint8Array(6) } }), /multiple of 4/);
});
