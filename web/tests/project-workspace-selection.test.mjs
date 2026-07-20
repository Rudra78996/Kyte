import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("inherits the active dashboard workspace without exposing its database id", async () => {
  const newProjectPage = await read("app/new/page.tsx")

  assert.match(newProjectPage, /localStorage\.getItem\("kyte-active-org"\)/)
  assert.match(newProjectPage, /organizationId: selectedOrgId/)
  assert.doesNotMatch(newProjectPage, /<Label>Organization<\/Label>/)
  assert.doesNotMatch(newProjectPage, /<Select value=\{selectedOrgId\}/)
})
