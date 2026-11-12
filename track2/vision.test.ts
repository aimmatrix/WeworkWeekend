import assert from "node:assert/strict"
import test from "node:test"
import { cleanBin, cleanSink, dirtyBin, dirtySink, flat, noisy, shift } from "./fixtures"
import { TARIFF } from "./tariff"
import { clutterOf, compareGray, measureGray } from "./vision"

test("a cleaned bin passes and the same photo fails", () => {
  const before = dirtyBin()
  const cleaned = compareGray(before, cleanBin(), "bins")
  assert.equal(cleaned.passed, true, JSON.stringify(measureGray(before, cleanBin())))
  assert.match(cleaned.reasons.join(" "), /bin/i)
  assert.deepEqual(cleaned.remaining_issues, [])
  assert.ok(cleaned.confidence > 0 && cleaned.confidence <= 1)

  const same = compareGray(before, before, "bins")
  assert.equal(same.passed, false, JSON.stringify(measureGray(before, before)))
  assert.match(same.reasons.join(" "), /before photo/i)
  assert.ok(same.remaining_issues.length > 0)

  const reshoot = compareGray(before, shift(before, 3, 2), "bins")
  assert.equal(reshoot.passed, false, JSON.stringify(measureGray(before, shift(before, 3, 2))))
  assert.ok(reshoot.remaining_issues.some((line) => /bin|rubbish/i.test(line)))
})

test("a cleaned sink passes and a still-dirty sink fails", () => {
  const before = dirtySink()
  const cleaned = compareGray(before, cleanSink(), "toilet")
  assert.equal(cleaned.passed, true, JSON.stringify(measureGray(before, cleanSink())))
  assert.match(cleaned.reasons.join(" "), /basin|sink/i)
  assert.deepEqual(cleaned.remaining_issues, [])

  const stillDirty = compareGray(before, dirtySink(2), "toilet")
  assert.equal(stillDirty.passed, false, JSON.stringify(measureGray(before, dirtySink(2))))
  assert.match(stillDirty.remaining_issues.join(" "), /basin|toilet/i)
})

test("every tariff category has plain pass and fail copy", () => {
  const before = noisy(1)
  const after = cleanBin()
  for (const row of TARIFF) {
    const passed = compareGray(before, after, row.category)
    assert.equal(passed.passed, true, `${row.category} ${JSON.stringify(measureGray(before, after))}`)
    assert.ok(passed.reasons.length > 0)
    assert.deepEqual(passed.remaining_issues, [])
    assertPlain(passed.reasons)

    const failed = compareGray(before, before, row.category)
    assert.equal(failed.passed, false)
    assert.ok(failed.remaining_issues.length > 0)
    assertPlain([...failed.reasons, ...failed.remaining_issues])
    assert.ok(failed.confidence >= 0 && failed.confidence <= 1)
  }
})

test("a blank after photo fails closed", () => {
  const result = compareGray(dirtyBin(), flat(255), "bins")
  assert.equal(result.passed, false)
  assert.match(result.reasons.join(" "), /dark or washed out/i)
  assert.ok(result.remaining_issues.length > 0)
})

test("a messy photo scores more clutter than a clear one", () => {
  assert.ok(clutterOf(dirtyBin()) > clutterOf(cleanBin()))
  assert.ok(clutterOf(dirtySink()) > clutterOf(cleanSink()))
})

function assertPlain(lines: string[]) {
  const text = lines.join(" ")
  assert.doesNotMatch(text, /stddev|clutterRatio|beforeClutter|mock-vision|confidence score/i)
  for (const line of lines) assert.match(line, /\.$/)
}
