import type { Passenger, Station } from './gameTypes'

// Names and avatars organized by gender presentation
const MASCULINE_NAMES = [
  'Ahmed', 'Bob', 'Carlos', 'Elias', 'Ethan', 'George', 'Ian', 'Kevin',
  'Marcus', 'Oliver', 'Victor', 'Xavier', 'Raj', 'David', 'Miguel', 'Jin'
]

const FEMININE_NAMES = [
  'Alice', 'Bella', 'Diana', 'Devi', 'Fatima', 'Fiona', 'Hannah', 'Julia',
  'Laura', 'Nina', 'Petra', 'Rosa', 'Tessa', 'Uma', 'Wendy', 'Zara', 'Yuki'
]

const GENDER_NEUTRAL_NAMES = [
  'Alex', 'Charlie', 'Jordan', 'Morgan', 'Quinn', 'Riley', 'Sam', 'Taylor'
]

// Masculine-presenting avatars
const MASCULINE_AVATARS = [
  '👨', '👨🏻', '👨🏼', '👨🏽', '👨🏾', '👨🏿',
  '👴', '👴🏻', '👴🏼', '👴🏽', '👴🏾', '👴🏿',
  '👦', '👦🏻', '👦🏼', '👦🏽', '👦🏾', '👦🏿',
  '🧔', '🧔🏻', '🧔🏼', '🧔🏽', '🧔🏾', '🧔🏿',
  '👨‍🦱', '👨🏻‍🦱', '👨🏼‍🦱', '👨🏽‍🦱', '👨🏾‍🦱', '👨🏿‍🦱',
  '👨‍🦰', '👨🏻‍🦰', '👨🏼‍🦰', '👨🏽‍🦰', '👨🏾‍🦰', '👨🏿‍🦰',
  '👱', '👱🏻', '👱🏼', '👱🏽', '👱🏾', '👱🏿'
]

// Feminine-presenting avatars
const FEMININE_AVATARS = [
  '👩', '👩🏻', '👩🏼', '👩🏽', '👩🏾', '👩🏿',
  '👵', '👵🏻', '👵🏼', '👵🏽', '👵🏾', '👵🏿',
  '👧', '👧🏻', '👧🏼', '👧🏽', '👧🏾', '👧🏿',
  '👩‍🦱', '👩🏻‍🦱', '👩🏼‍🦱', '👩🏽‍🦱', '👩🏾‍🦱', '👩🏿‍🦱',
  '👩‍🦰', '👩🏻‍🦰', '👩🏼‍🦰', '👩🏽‍🦰', '👩🏾‍🦰', '👩🏿‍🦰',
  '👱‍♀️', '👱🏻‍♀️', '👱🏼‍♀️', '👱🏽‍♀️', '👱🏾‍♀️', '👱🏿‍♀️'
]

// Gender-neutral avatars
const NEUTRAL_AVATARS = [
  '🧑', '🧑🏻', '🧑🏼', '🧑🏽', '🧑🏾', '🧑🏿'
]

/**
 * Generate 3-5 passengers with random names and destinations
 * 30% chance of urgent passengers
 */
export function generatePassengers(stations: Station[]): Passenger[] {
  const count = Math.floor(Math.random() * 3) + 3 // 3-5 passengers
  const passengers: Passenger[] = []
  const usedCombos = new Set<string>()

  for (let i = 0; i < count; i++) {
    let name: string
    let avatar: string
    let comboKey: string

    // Keep trying until we get a unique name/avatar combo
    do {
      // Randomly choose a gender category
      const genderRoll = Math.random()
      let namePool: string[]
      let avatarPool: string[]

      if (genderRoll < 0.45) {
        // 45% masculine
        namePool = MASCULINE_NAMES
        avatarPool = MASCULINE_AVATARS
      } else if (genderRoll < 0.9) {
        // 45% feminine
        namePool = FEMININE_NAMES
        avatarPool = FEMININE_AVATARS
      } else {
        // 10% neutral
        namePool = GENDER_NEUTRAL_NAMES
        avatarPool = NEUTRAL_AVATARS
      }

      // Pick from the chosen category
      name = namePool[Math.floor(Math.random() * namePool.length)]
      avatar = avatarPool[Math.floor(Math.random() * avatarPool.length)]
      comboKey = `${name}-${avatar}`
    } while (usedCombos.has(comboKey) && usedCombos.size < 100) // Prevent infinite loop

    usedCombos.add(comboKey)

    // Pick random origin and destination stations (must be different)
    // 40% chance to start at depot, 60% chance to start at other stations
    let originStation: Station
    let destination: Station

    if (Math.random() < 0.4 || stations.length < 3) {
      // Start at depot
      originStation = stations[0]
      // Pick any other station as destination
      const otherStations = stations.slice(1)
      destination = otherStations[Math.floor(Math.random() * otherStations.length)]
    } else {
      // Start at a random non-depot station
      const nonDepotStations = stations.slice(1)
      originStation = nonDepotStations[Math.floor(Math.random() * nonDepotStations.length)]

      // Pick a different station as destination (can include depot)
      const possibleDestinations = stations.filter(s => s.id !== originStation.id)
      destination = possibleDestinations[Math.floor(Math.random() * possibleDestinations.length)]
    }

    // 30% chance of urgent
    const isUrgent = Math.random() < 0.3

    passengers.push({
      id: `passenger-${Date.now()}-${i}`,
      name,
      avatar,
      originStationId: originStation.id,
      destinationStationId: destination.id,
      isUrgent,
      isBoarded: false,
      isDelivered: false
    })
  }

  return passengers
}

/**
 * Check if train is at a station (within 3% tolerance)
 */
export function isTrainAtStation(trainPosition: number, stationPosition: number): boolean {
  return Math.abs(trainPosition - stationPosition) < 3
}

/**
 * Find passengers that should board at current position
 */
export function findBoardablePassengers(
  passengers: Passenger[],
  stations: Station[],
  trainPosition: number
): Passenger[] {
  const boardable: Passenger[] = []

  for (const passenger of passengers) {
    // Skip if already boarded or delivered
    if (passenger.isBoarded || passenger.isDelivered) continue

    const station = stations.find(s => s.id === passenger.originStationId)
    if (!station) continue

    if (isTrainAtStation(trainPosition, station.position)) {
      boardable.push(passenger)
    }
  }

  return boardable
}

/**
 * Find passengers that should be delivered at current position
 */
export function findDeliverablePassengers(
  passengers: Passenger[],
  stations: Station[],
  trainPosition: number
): Array<{ passenger: Passenger; station: Station; points: number }> {
  const deliverable: Array<{ passenger: Passenger; station: Station; points: number }> = []

  for (const passenger of passengers) {
    // Only check boarded passengers
    if (!passenger.isBoarded || passenger.isDelivered) continue

    const station = stations.find(s => s.id === passenger.destinationStationId)
    if (!station) continue

    if (isTrainAtStation(trainPosition, station.position)) {
      const points = passenger.isUrgent ? 20 : 10
      deliverable.push({ passenger, station, points })
    }
  }

  return deliverable
}