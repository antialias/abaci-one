import type { Passenger, Station } from './gameTypes'

// Passenger name pool (mix of diverse names)
const PASSENGER_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Ethan', 'Fiona', 'George', 'Hannah',
  'Ian', 'Julia', 'Kevin', 'Laura', 'Marcus', 'Nina', 'Oliver', 'Petra',
  'Quinn', 'Rosa', 'Sam', 'Tessa', 'Uma', 'Victor', 'Wendy', 'Xavier',
  'Yuki', 'Zara', 'Ahmed', 'Bella', 'Carlos', 'Devi', 'Elias', 'Fatima'
]

/**
 * Generate 3-5 passengers with random names and destinations
 * 30% chance of urgent passengers
 */
export function generatePassengers(stations: Station[]): Passenger[] {
  const count = Math.floor(Math.random() * 3) + 3 // 3-5 passengers
  const passengers: Passenger[] = []
  const usedNames = new Set<string>()

  for (let i = 0; i < count; i++) {
    // Pick a unique name
    let name: string
    do {
      name = PASSENGER_NAMES[Math.floor(Math.random() * PASSENGER_NAMES.length)]
    } while (usedNames.has(name) && usedNames.size < PASSENGER_NAMES.length)
    usedNames.add(name)

    // Pick a random destination (exclude first station - Depot)
    const destinationStations = stations.slice(1) // Exclude starting depot
    const destination = destinationStations[Math.floor(Math.random() * destinationStations.length)]

    // 30% chance of urgent
    const isUrgent = Math.random() < 0.3

    passengers.push({
      id: `passenger-${Date.now()}-${i}`,
      name,
      destinationStationId: destination.id,
      isUrgent,
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
 * Find passengers that should be delivered at current position
 */
export function findDeliverablePassengers(
  passengers: Passenger[],
  stations: Station[],
  trainPosition: number
): Array<{ passenger: Passenger; station: Station; points: number }> {
  const deliverable: Array<{ passenger: Passenger; station: Station; points: number }> = []

  for (const passenger of passengers) {
    if (passenger.isDelivered) continue

    const station = stations.find(s => s.id === passenger.destinationStationId)
    if (!station) continue

    if (isTrainAtStation(trainPosition, station.position)) {
      const points = passenger.isUrgent ? 20 : 10
      deliverable.push({ passenger, station, points })
    }
  }

  return deliverable
}