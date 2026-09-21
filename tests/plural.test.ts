import { expect, test } from "bun:test";
import { plural } from "../src/shared/plural.ts";

test("one takes the singular, everything else the plural", () => {
  expect(plural(1, "part")).toBe("1 part");
  expect(plural(0, "part")).toBe("0 parts");
  expect(plural(2, "face")).toBe("2 faces");
});

test("an irregular plural is passed in", () => {
  expect(plural(1, "vertex", "vertices")).toBe("1 vertex");
  expect(plural(3, "vertex", "vertices")).toBe("3 vertices");
});

test("large counts are grouped", () => {
  expect(plural(1020, "token")).toBe("1,020 tokens");
});
