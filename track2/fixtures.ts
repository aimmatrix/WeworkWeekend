import type { Gray } from "./vision"

export function paint(width: number, height: number, pixel: (x: number, y: number) => number): Gray {
  const px = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) px[y * width + x] = pixel(x, y) & 255
  }
  return { w: width, h: height, px }
}

function hash(n: number): number {
  let x = n | 0
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d)
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b)
  x = (x ^ (x >>> 16)) >>> 0
  return x / 4294967296
}

export function flat(value: number, size = 64): Gray {
  return paint(size, size, () => value)
}

export function dirtyBin(seed = 1): Gray {
  return paint(64, 64, (x, y) => {
    const inBin = x > 16 && x < 48 && y > 14 && y < 54
    const noise = hash((x + seed * 13) * 928371 + (y + seed * 7) * 689287)
    if (inBin) {
      const chunk = hash(seed * 1009 + Math.floor(x / 4) * 50 + Math.floor(y / 4) * 17)
      return chunk > 0.45 ? 20 + Math.floor(noise * 50) : 160 + Math.floor(noise * 90)
    }
    return 70 + Math.floor(hash(seed * 17 + x * 3 + y * 19) * 90)
  })
}

export function cleanBin(): Gray {
  return paint(64, 64, (x, y) => {
    const inBin = x > 16 && x < 48 && y > 14 && y < 54
    if (inBin) return 76 + Math.floor(y / 20)
    return 168 + Math.floor((x + y) / 80)
  })
}

const STAINS: readonly (readonly [number, number, number])[] = [
  [24, 30, 7],
  [40, 36, 6],
  [30, 42, 5],
  [36, 28, 4],
  [28, 24, 5],
]

export function dirtySink(seed = 1): Gray {
  return paint(64, 64, (x, y) => {
    const dx = x - 32
    const dy = y - 34
    const basin = (dx * dx) / (26 * 26) + (dy * dy) / (20 * 20) <= 1
    let value = basin ? 176 : 96 + Math.floor(hash(x * 9 + y * 3 + seed) * 40)
    for (const [sx, sy, radius] of STAINS) {
      if (Math.hypot(x - sx, y - sy) < radius) {
        value = 28 + Math.floor(hash(seed * 99 + sx * 10 + sy) * 36)
      }
    }
    if (basin && hash(seed * 500 + x * 17 + y * 13) > 0.62) value = 24
    return value
  })
}

export function cleanSink(): Gray {
  return paint(64, 64, (x, y) => {
    const dx = x - 32
    const dy = y - 34
    const basin = (dx * dx) / (26 * 26) + (dy * dy) / (20 * 20) <= 1
    if (!basin) return 158
    return 214 + Math.floor(dy / 18)
  })
}

export function noisy(seed = 1): Gray {
  return paint(64, 64, (x, y) => {
    const chunk = hash(seed * 17 + Math.floor(x / 3) * 31 + Math.floor(y / 3) * 97)
    const speck = hash(x * 13 + y * 64 + seed * 9)
    return chunk > 0.5 ? 15 + Math.floor(speck * 40) : 180 + Math.floor(speck * 70)
  })
}

export function shift(gray: Gray, dx: number, dy: number): Gray {
  const px = new Uint8Array(gray.px.length)
  for (let y = 0; y < gray.h; y += 1) {
    for (let x = 0; x < gray.w; x += 1) {
      const sourceX = Math.min(gray.w - 1, Math.max(0, x - dx))
      const sourceY = Math.min(gray.h - 1, Math.max(0, y - dy))
      px[y * gray.w + x] = gray.px[sourceY * gray.w + sourceX] ?? 0
    }
  }
  return { w: gray.w, h: gray.h, px }
}
