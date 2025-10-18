import type { SortingCard } from '../types'

/**
 * Place a card at a specific position, shifting existing cards
 * Returns new placedCards array with no gaps
 */
export function placeCardAtPosition(
	placedCards: (SortingCard | null)[],
	cardToPlace: SortingCard,
	position: number,
	totalSlots: number,
): { placedCards: (SortingCard | null)[]; excessCards: SortingCard[] } {
	// Create working array
	const newPlaced = new Array(totalSlots).fill(null)

	// Copy existing cards, shifting those at/after position
	for (let i = 0; i < placedCards.length; i++) {
		if (placedCards[i] !== null) {
			if (i < position) {
				// Before insert position - stays same
				newPlaced[i] = placedCards[i]
			} else {
				// At or after position - shift right
				if (i + 1 < totalSlots) {
					newPlaced[i + 1] = placedCards[i]
				}
			}
		}
	}

	// Place new card
	newPlaced[position] = cardToPlace

	// Compact to remove gaps (shift all cards left)
	const compacted: SortingCard[] = []
	for (const card of newPlaced) {
		if (card !== null) {
			compacted.push(card)
		}
	}

	// Fill final array
	const result = new Array(totalSlots).fill(null)
	for (let i = 0; i < Math.min(compacted.length, totalSlots); i++) {
		result[i] = compacted[i]
	}

	// Any excess cards are returned (shouldn't happen)
	const excess = compacted.slice(totalSlots)

	return { placedCards: result, excessCards: excess }
}

/**
 * Remove card at position
 */
export function removeCardAtPosition(
	placedCards: (SortingCard | null)[],
	position: number,
): { placedCards: (SortingCard | null)[]; removedCard: SortingCard | null } {
	const removedCard = placedCards[position]

	if (!removedCard) {
		return { placedCards, removedCard: null }
	}

	// Remove card and compact
	const compacted: SortingCard[] = []
	for (let i = 0; i < placedCards.length; i++) {
		if (i !== position && placedCards[i] !== null) {
			compacted.push(placedCards[i] as SortingCard)
		}
	}

	// Fill new array
	const newPlaced = new Array(placedCards.length).fill(null)
	for (let i = 0; i < compacted.length; i++) {
		newPlaced[i] = compacted[i]
	}

	return { placedCards: newPlaced, removedCard }
}
