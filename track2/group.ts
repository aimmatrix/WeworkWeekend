const ROOM_ORDER = ["Toilet", "Kitchen", "Office"]

export function groupByRoom<T extends { room: string }>(items: readonly T[]): { room: string; items: T[] }[] {
  const groups: { room: string; items: T[] }[] = []
  const index = new Map<string, number>()
  for (const item of items) {
    const found = index.get(item.room)
    if (found === undefined) {
      index.set(item.room, groups.length)
      groups.push({ room: item.room, items: [item] })
    } else {
      const group = groups[found]
      if (group) group.items.push(item)
    }
  }
  return groups.sort((a, b) => roomRank(a.room) - roomRank(b.room))
}

function roomRank(room: string): number {
  const rank = ROOM_ORDER.indexOf(room)
  return rank === -1 ? ROOM_ORDER.length : rank
}
