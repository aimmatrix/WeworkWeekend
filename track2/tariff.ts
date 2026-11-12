import type { Category } from "./types"

export type TariffRow = {
  category: Category
  room: string
  short: string
  title: string
  credit_hours: number
}

const ROWS: Record<Category, TariffRow> = {
  toilet: {
    category: "toilet",
    room: "Toilet",
    short: "Toilet",
    title: "Clean the toilet and basin",
    credit_hours: 3,
  },
  kitchen: {
    category: "kitchen",
    room: "Kitchen",
    short: "Kitchen",
    title: "Clear and wipe the kitchen",
    credit_hours: 2,
  },
  bins: {
    category: "bins",
    room: "Kitchen",
    short: "Bins",
    title: "Empty the bins",
    credit_hours: 1,
  },
  floor: {
    category: "floor",
    room: "Office",
    short: "Floor",
    title: "Sweep and mop the floor",
    credit_hours: 1,
  },
  desks: {
    category: "desks",
    room: "Office",
    short: "Desks",
    title: "Clear the desks",
    credit_hours: 0.5,
  },
  furniture_reset: {
    category: "furniture_reset",
    room: "Office",
    short: "Furniture",
    title: "Reset the furniture",
    credit_hours: 0.5,
  },
}

export const TARIFF_ORDER: readonly Category[] = [
  "toilet",
  "kitchen",
  "bins",
  "floor",
  "desks",
  "furniture_reset",
]

export const TARIFF: readonly TariffRow[] = TARIFF_ORDER.map((category) => ROWS[category])

export function isCategory(value: string): value is Category {
  return Object.prototype.hasOwnProperty.call(ROWS, value)
}

export function tariffFor(category: string): TariffRow | null {
  if (!isCategory(category)) return null
  return ROWS[category]
}

export function crewSizeForHours(hours: number): number {
  if (hours <= 4) return 1
  if (hours <= 8) return 2
  return 3
}

export function sumHours(hours: readonly number[]): number {
  const total = hours.reduce((sum, value) => sum + value, 0)
  return Math.round(total * 10) / 10
}
