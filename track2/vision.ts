import { isCategory } from "./tariff"
import type { Category } from "./types"

export const VISION_SIZE = 64

const UNCHANGED_MAD = 0.025
const MIN_CLUTTER_DROP = 0.18
const MAX_CLEAN_CLUTTER = 0.45
const MAX_CLEAN_RATIO = 0.72
const BOTH_CLEAN = 0.16
const BUSY_STD = 18
const BLANK_SPREAD = 1.5
const BLANK_DARK = 8
const BLANK_WHITE = 250

export type Gray = {
  w: number
  h: number
  px: Uint8Array
}

export type Metrics = {
  mad: number
  beforeClutter: number
  afterClutter: number
  beforeMean: number
  afterMean: number
  afterSpread: number
}

export type Decision = {
  passed: boolean
  confidence: number
  reasons: string[]
  remaining_issues: string[]
}

type VerdictKind = "pass" | "unchanged" | "dirty"
type Copy = { reasons: string[]; remaining_issues: string[] }

const COPY: Record<Category, Record<VerdictKind, Copy>> = {
  toilet: {
    pass: {
      reasons: ["The basin looks clear.", "The sink and toilet look wiped down."],
      remaining_issues: [],
    },
    unchanged: {
      reasons: ["This matches the before photo.", "The basin still looks dirty."],
      remaining_issues: ["Marks are still in the basin.", "The toilet still needs a clean."],
    },
    dirty: {
      reasons: ["The basin still has marks.", "This doesn't look wiped down yet."],
      remaining_issues: ["Marks are still in the basin.", "The toilet still needs a wipe."],
    },
  },
  kitchen: {
    pass: {
      reasons: ["The counters look clear.", "The kitchen surfaces look wiped."],
      remaining_issues: [],
    },
    unchanged: {
      reasons: ["This matches the before photo.", "The kitchen still looks cluttered."],
      remaining_issues: ["Clutter is still on the counters.", "The surfaces still need a wipe."],
    },
    dirty: {
      reasons: ["The counters still look cluttered.", "The kitchen doesn't look finished."],
      remaining_issues: ["Clutter is still on the counters.", "The surfaces still need a wipe."],
    },
  },
  bins: {
    pass: {
      reasons: ["The bin looks empty.", "The area around it is clear."],
      remaining_issues: [],
    },
    unchanged: {
      reasons: ["This matches the before photo.", "The bin still looks full."],
      remaining_issues: ["The bin is still full.", "Rubbish is still around the bin."],
    },
    dirty: {
      reasons: ["The bin still looks full.", "The area around it isn't clear yet."],
      remaining_issues: ["Rubbish is still in the bin.", "The floor around the bin still needs a sweep."],
    },
  },
  floor: {
    pass: {
      reasons: ["The floor looks clear.", "The debris from the before photo is gone."],
      remaining_issues: [],
    },
    unchanged: {
      reasons: ["This matches the before photo.", "The floor still looks dirty."],
      remaining_issues: ["Debris is still on the floor."],
    },
    dirty: {
      reasons: ["The floor still looks dirty.", "Debris is still visible."],
      remaining_issues: ["Debris is still on the floor."],
    },
  },
  desks: {
    pass: {
      reasons: ["The desktops look clear.", "Papers and rubbish are off the desks."],
      remaining_issues: [],
    },
    unchanged: {
      reasons: ["This matches the before photo.", "The desks still look cluttered."],
      remaining_issues: ["The desks are still cluttered."],
    },
    dirty: {
      reasons: ["The desks still look cluttered.", "Papers and rubbish are still on top."],
      remaining_issues: ["The desks are still cluttered."],
    },
  },
  furniture_reset: {
    pass: {
      reasons: ["The furniture is back in place.", "The room looks reset."],
      remaining_issues: [],
    },
    unchanged: {
      reasons: ["This matches the before photo.", "The furniture still looks out of place."],
      remaining_issues: ["The furniture still needs a reset."],
    },
    dirty: {
      reasons: ["The furniture still looks out of place.", "The room isn't reset yet."],
      remaining_issues: ["The furniture still needs a reset."],
    },
  },
}

const GENERIC: Record<VerdictKind, Copy> = {
  pass: {
    reasons: ["The after photo looks clearer than the before.", "The mess in this shot looks gone."],
    remaining_issues: [],
  },
  unchanged: {
    reasons: ["This matches the before photo.", "It doesn't look cleaned yet."],
    remaining_issues: ["The scene looks unchanged.", "Shoot again after the clean, from the same angle."],
  },
  dirty: {
    reasons: ["This still looks messy.", "It isn't clear enough to pass."],
    remaining_issues: ["Dirt is still visible.", "Have another go from the same angle."],
  },
}

const BLANK: Copy = {
  reasons: ["The after photo is too dark or washed out to judge."],
  remaining_issues: ["Take another shot with the light on."],
}

export function rgbaToGray(data: Uint8ClampedArray | Uint8Array, width: number, height: number): Gray {
  const px = new Uint8Array(width * height)
  for (let i = 0; i < px.length; i += 1) {
    const offset = i * 4
    const red = data[offset] ?? 0
    const green = data[offset + 1] ?? 0
    const blue = data[offset + 2] ?? 0
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    px[i] = clampByte(Math.round(luminance))
  }
  return { w: width, h: height, px }
}

export function clutterOf(gray: Gray): number {
  const block = 8
  let busy = 0
  let total = 0
  for (let y = 0; y < gray.h; y += block) {
    for (let x = 0; x < gray.w; x += block) {
      total += 1
      if (blockStd(gray, x, y, block) >= BUSY_STD) busy += 1
    }
  }
  if (total === 0) return 0
  return busy / total
}

export function measureGray(before: Gray, after: Gray): Metrics {
  const left = resample(before, VISION_SIZE, VISION_SIZE)
  const right = resample(after, VISION_SIZE, VISION_SIZE)
  let diff = 0
  for (let i = 0; i < left.px.length; i += 1) {
    diff += Math.abs((left.px[i] ?? 0) - (right.px[i] ?? 0))
  }
  const afterMean = mean(right.px)
  return {
    mad: diff / left.px.length / 255,
    beforeClutter: clutterOf(left),
    afterClutter: clutterOf(right),
    beforeMean: mean(left.px),
    afterMean,
    afterSpread: spread(right.px, afterMean),
  }
}

export function decide(metrics: Metrics, category: string): Decision {
  const blank = metrics.afterMean < BLANK_DARK || metrics.afterMean > BLANK_WHITE || metrics.afterSpread < BLANK_SPREAD
  const unchanged = metrics.mad < UNCHANGED_MAD
  const drop = metrics.beforeClutter - metrics.afterClutter
  const ratio = metrics.afterClutter / (metrics.beforeClutter + 1e-4)
  const improved = drop >= MIN_CLUTTER_DROP && ratio <= MAX_CLEAN_RATIO && metrics.afterClutter <= MAX_CLEAN_CLUTTER
  const bothClean =
    metrics.beforeClutter <= BOTH_CLEAN && metrics.afterClutter <= BOTH_CLEAN && metrics.mad >= UNCHANGED_MAD
  const passed = !blank && !unchanged && (improved || bothClean)
  const kind: VerdictKind | "blank" = blank ? "blank" : unchanged ? "unchanged" : passed ? "pass" : "dirty"
  const copy = kind === "blank" ? BLANK : lines(category, kind)
  return {
    passed: kind === "pass",
    confidence: confidenceFor(kind, metrics, ratio),
    reasons: copy.reasons,
    remaining_issues: copy.remaining_issues,
  }
}

export function compareGray(before: Gray, after: Gray, category: string): Decision {
  return decide(measureGray(before, after), category)
}

function lines(category: string, kind: VerdictKind): Copy {
  if (!isCategory(category)) return GENERIC[kind]
  return COPY[category][kind]
}

function confidenceFor(kind: VerdictKind | "blank", metrics: Metrics, ratio: number): number {
  switch (kind) {
    case "blank":
      return 0.44
    case "unchanged":
      return round2(clamp(0.92 - metrics.mad, 0.8, 0.96))
    case "pass":
      return round2(clamp(0.7 + (1 - ratio) * 0.22, 0.66, 0.94))
    case "dirty":
      return round2(clamp(0.56 + ratio * 0.22, 0.52, 0.84))
    default: {
      const neverKind: never = kind
      throw new Error(`Unknown verdict ${String(neverKind)}`)
    }
  }
}

function resample(gray: Gray, width: number, height: number): Gray {
  if (gray.w === width && gray.h === height) return gray
  const px = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(gray.h - 1, Math.floor((y * gray.h) / height))
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(gray.w - 1, Math.floor((x * gray.w) / width))
      px[y * width + x] = gray.px[sourceY * gray.w + sourceX] ?? 0
    }
  }
  return { w: width, h: height, px }
}

function blockStd(gray: Gray, x0: number, y0: number, size: number): number {
  let total = 0
  let count = 0
  for (let y = y0; y < y0 + size && y < gray.h; y += 1) {
    for (let x = x0; x < x0 + size && x < gray.w; x += 1) {
      total += gray.px[y * gray.w + x] ?? 0
      count += 1
    }
  }
  if (count === 0) return 0
  const avg = total / count
  let variance = 0
  for (let y = y0; y < y0 + size && y < gray.h; y += 1) {
    for (let x = x0; x < x0 + size && x < gray.w; x += 1) {
      const delta = (gray.px[y * gray.w + x] ?? 0) - avg
      variance += delta * delta
    }
  }
  return Math.sqrt(variance / count)
}

function mean(px: Uint8Array): number {
  let total = 0
  for (let i = 0; i < px.length; i += 1) total += px[i] ?? 0
  return total / px.length
}

function spread(px: Uint8Array, avg: number): number {
  let variance = 0
  for (let i = 0; i < px.length; i += 1) {
    const delta = (px[i] ?? 0) - avg
    variance += delta * delta
  }
  return Math.sqrt(variance / px.length)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clampByte(value: number): number {
  return clamp(value, 0, 255)
}
