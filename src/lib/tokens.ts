/** Client-safe helpers for racket tokens; the switch itself is server-only. */

/** Carabiners 1..count that no open request is using. */
export function freeTokens(count: number, inUse: Array<number>) {
  const taken = new Set(inUse)
  return Array.from({ length: count }, (_, i) => i + 1).filter(
    (n) => !taken.has(n),
  )
}

/** [1, 2, 3, 5, 7, 8] → "1–3, 5, 7–8" — short enough for a form hint. */
export function formatTokenRanges(numbers: Array<number>) {
  const parts: Array<string> = []
  for (let i = 0; i < numbers.length; i++) {
    const start = numbers[i]
    while (i + 1 < numbers.length && numbers[i + 1] === numbers[i] + 1) i++
    const end = numbers[i]
    parts.push(start === end ? `${start}` : `${start}–${end}`)
  }
  return parts.join(', ')
}
