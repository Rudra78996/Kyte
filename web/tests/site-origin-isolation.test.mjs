import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const siteUrl = readFileSync(join(root, "lib/site-url.ts"), "utf8");
const pages = [
  "app/new/page.tsx",
  "app/(app)/projects/[id]/page.tsx",
  "app/(app)/dashboard/page.tsx",
  "app/(app)/dashboard/deployments/page.tsx",
].map((file) => readFileSync(join(root, file), "utf8"));

test("generated deployment links use only the dedicated sites origin", () => {
  assert.match(siteUrl, /NEXT_PUBLIC_SITES_DOMAIN/);
  assert.match(siteUrl, /sites\.localhost/);
  for (const page of pages) {
    assert.doesNotMatch(page, /NEXT_PUBLIC_BASE_DOMAIN/);
  }
});
