import assert from "node:assert/strict";
import { test } from "node:test";
import { LOCATIONS, cityFileName, problemPath, validateCity, type CityJson } from "../src/index.ts";

function city(overrides: Partial<CityJson> = {}): CityJson {
  return {
    name: "Lolly World",
    mapX: 52,
    mapY: 85,
    image: "",
    intro: ["Welcome to Lolly World."],
    treasures: ["a lolly"],
    clues: Object.fromEntries(LOCATIONS.slice(0, 8).map((l) => [l, ["@1 changed @2 money to lollies."]])),
    ...overrides,
  };
}

const paths = (json: CityJson) => validateCity(json).map(problemPath);

test("a complete city has no problems", () => {
  assert.deepEqual(validateCity(city()), []);
});

test("name is required, at most 20 characters, ASCII, no @", () => {
  assert.deepEqual(paths(city({ name: "" })), ["name"]);
  assert.deepEqual(paths(city({ name: "x".repeat(20) })), []);
  assert.deepEqual(paths(city({ name: "x".repeat(21) })), ["name"]);
  assert.deepEqual(paths(city({ name: "Malmö" })), ["name"]);
  assert.deepEqual(paths(city({ name: "@1 town" })), ["name"]);
});

test("map position must be a whole number on the 264x95 map", () => {
  assert.deepEqual(paths(city({ mapX: 263, mapY: 94 })), []);
  assert.deepEqual(paths(city({ mapX: 264, mapY: 95 })), ["mapX", "mapY"]);
  assert.deepEqual(paths(city({ mapX: -1, mapY: 1.5 })), ["mapX", "mapY"]);
  assert.deepEqual(paths(city({ mapX: NaN })), ["mapX"]);
});

test("strings are at most 160 characters and plain ASCII", () => {
  assert.deepEqual(paths(city({ intro: ["x".repeat(160)] })), []);
  assert.deepEqual(paths(city({ intro: ["ok", "x".repeat(161)] })), ["intro[1]"]);
  assert.deepEqual(paths(city({ treasures: ["a “curly” lolly"] })), ["treasures[0]"]);
  assert.deepEqual(paths(city({ treasures: ["  "] })), ["treasures[0]"]);
});

test("intro and treasures can't be empty", () => {
  assert.deepEqual(paths(city({ intro: [], treasures: [] })), ["intro", "treasures"]);
});

test("clues allow only @1 and @2; other lists allow no @ at all", () => {
  const clues = { ...city().clues, hotel: ["@1 met @2 friend", "@3 left", "email me @ home"] };
  assert.deepEqual(paths(city({ clues })), ["clues.hotel[1]", "clues.hotel[2]"]);
  assert.deepEqual(paths(city({ intro: ["@1 arrived"] })), ["intro[0]"]);
});

test("at least 8 locations need clues, and a present location can't be empty", () => {
  const seven = Object.fromEntries(LOCATIONS.slice(0, 7).map((l) => [l, ["clue"]]));
  assert.deepEqual(paths(city({ clues: seven })), ["locations"]);
  assert.deepEqual(paths(city({ clues: { ...city().clues, harbor: [] } })), ["clues.harbor"]);
});

test("file names follow the original 8.3 naming", () => {
  assert.equal(cityFileName("Rio de Janeiro"), "RIODEJAN.CIT");
  assert.equal(cityFileName("Port Moresby"), "PORTMORE.CIT");
  assert.equal(cityFileName("Lolly World"), "LOLLYWOR.CIT");
  assert.equal(cityFileName("Oslo"), "OSLO.CIT");
  assert.equal(cityFileName("!!!"), "CITY.CIT");
  assert.equal(cityFileName(""), "CITY.CIT");
});
