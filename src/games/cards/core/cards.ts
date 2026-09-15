export const SUITS = ['spades', 'hearts', 'clubs', 'diamonds'] as const
export type Suit = typeof SUITS[number]
export type CardColor = 'black' | 'red'

export interface Card {
  id: string
  suit: Suit
  rank: number
  color: CardColor
}

export type RandomSource = () => number

export function createDeck(decks = 1, suits: readonly Suit[] = SUITS): Card[] {
  const cards: Card[] = []
  for (let deck = 0; deck < decks; deck += 1) {
    for (const suit of suits) {
      for (let rank = 1; rank <= 13; rank += 1) {
        cards.push({
          id: `${deck}-${suit}-${rank}`,
          suit,
          rank,
          color: suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black'
        })
      }
    }
  }
  return cards
}

export function shuffle<T>(values: readonly T[], random: RandomSource = Math.random): T[] {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const choice = Math.floor(normalizeRandom(random()) * (index + 1))
    const value = result[index]
    const other = result[choice]
    if (value !== undefined && other !== undefined) {
      result[index] = other
      result[choice] = value
    }
  }
  return result
}

export function rankLabel(rank: number): string {
  return ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' } as Record<number, string>)[rank] ?? String(rank)
}

export function suitSymbol(suit: Suit): string {
  return { spades: '♠', hearts: '♥', clubs: '♣', diamonds: '♦' }[suit]
}

function normalizeRandom(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(value, 0.999999999999))
}

