import type { Category } from "./types";

/** Fixed tariff in credit hours. The model picks a category; the price is ours. */
export const TARIFF: Record<Category, number> = {
  toilet: 3,
  kitchen: 2,
  bins: 1,
  floor: 1,
  desks: 0.5,
  furniture_reset: 0.5,
};

export const CATEGORY_LABEL: Record<Category, string> = {
  toilet: "Toilet",
  kitchen: "Kitchen",
  bins: "Bins",
  floor: "Floor",
  desks: "Desks",
  furniture_reset: "Furniture reset",
};

export const CATEGORIES = Object.keys(TARIFF) as Category[];
