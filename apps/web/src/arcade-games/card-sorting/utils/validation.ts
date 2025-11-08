import type { SortingCard } from "../types";

/**
 * Place a card at a specific position (simple replacement, can leave gaps)
 * This is used when clicking directly on a slot
 * Returns old card if slot was occupied
 */
export function placeCardAtPosition(
  placedCards: (SortingCard | null)[],
  cardToPlace: SortingCard,
  position: number,
): { placedCards: (SortingCard | null)[]; replacedCard: SortingCard | null } {
  const newPlaced = [...placedCards];
  const replacedCard = newPlaced[position];
  newPlaced[position] = cardToPlace;
  return { placedCards: newPlaced, replacedCard };
}

/**
 * Insert a card at a specific position, shifting existing cards and compacting
 * This is used when clicking a + (insert) button
 * Returns new placedCards array with no gaps
 */
export function insertCardAtPosition(
  placedCards: (SortingCard | null)[],
  cardToPlace: SortingCard,
  insertPosition: number,
  totalSlots: number,
): { placedCards: (SortingCard | null)[]; excessCards: SortingCard[] } {
  // Create working array
  const newPlaced = new Array(totalSlots).fill(null);

  // Copy existing cards, shifting those at/after position
  for (let i = 0; i < placedCards.length; i++) {
    if (placedCards[i] !== null) {
      if (i < insertPosition) {
        // Before insert position - stays same
        newPlaced[i] = placedCards[i];
      } else {
        // At or after position - shift right
        if (i + 1 < totalSlots) {
          newPlaced[i + 1] = placedCards[i];
        } else {
          // Card would fall off, will be handled by compaction
          newPlaced[i + 1] = placedCards[i];
        }
      }
    }
  }

  // Place new card at insert position
  newPlaced[insertPosition] = cardToPlace;

  // Compact to remove gaps (shift all cards left)
  const compacted: SortingCard[] = [];
  for (const card of newPlaced) {
    if (card !== null) {
      compacted.push(card);
    }
  }

  // Fill final array with compacted cards (no gaps)
  const result = new Array(totalSlots).fill(null);
  for (let i = 0; i < Math.min(compacted.length, totalSlots); i++) {
    result[i] = compacted[i];
  }

  // Any excess cards are returned
  const excess = compacted.slice(totalSlots);

  return { placedCards: result, excessCards: excess };
}

/**
 * Remove card at position
 */
export function removeCardAtPosition(
  placedCards: (SortingCard | null)[],
  position: number,
): { placedCards: (SortingCard | null)[]; removedCard: SortingCard | null } {
  const removedCard = placedCards[position];

  if (!removedCard) {
    return { placedCards, removedCard: null };
  }

  // Remove card and compact
  const compacted: SortingCard[] = [];
  for (let i = 0; i < placedCards.length; i++) {
    if (i !== position && placedCards[i] !== null) {
      compacted.push(placedCards[i] as SortingCard);
    }
  }

  // Fill new array
  const newPlaced = new Array(placedCards.length).fill(null);
  for (let i = 0; i < compacted.length; i++) {
    newPlaced[i] = compacted[i];
  }

  return { placedCards: newPlaced, removedCard };
}
