import { useEffect, useRef, useState } from 'react'
import type { RailroadTrackGenerator } from '../lib/RailroadTrackGenerator'
import type { Station, Passenger } from '../lib/gameTypes'
import { generateLandmarks, type Landmark } from '../lib/landmarks'

interface UseTrackManagementParams {
  currentRoute: number
  trainPosition: number
  trackGenerator: RailroadTrackGenerator
  pathRef: React.RefObject<SVGPathElement>
  stations: Station[]
  passengers: Passenger[]
  maxCars?: number
  carSpacing?: number
}

export function useTrackManagement({
  currentRoute,
  trainPosition,
  trackGenerator,
  pathRef,
  stations,
  passengers,
  maxCars = 5,
  carSpacing = 7
}: UseTrackManagementParams) {
  const [trackData, setTrackData] = useState<ReturnType<typeof trackGenerator.generateTrack> | null>(null)
  const [tiesAndRails, setTiesAndRails] = useState<{
    ties: Array<{ x1: number; y1: number; x2: number; y2: number }>
    leftRailPoints: string[]
    rightRailPoints: string[]
  } | null>(null)
  const [stationPositions, setStationPositions] = useState<Array<{ x: number; y: number }>>([])
  const [landmarks, setLandmarks] = useState<Landmark[]>([])
  const [landmarkPositions, setLandmarkPositions] = useState<Array<{ x: number; y: number }>>([])
  const [displayPassengers, setDisplayPassengers] = useState<Passenger[]>(passengers)

  // Track previous route data to maintain visuals during transition
  const previousRouteRef = useRef(currentRoute)
  const [pendingTrackData, setPendingTrackData] = useState<ReturnType<typeof trackGenerator.generateTrack> | null>(null)
  const previousPassengersRef = useRef<Passenger[]>(passengers)

  // Generate landmarks when route changes
  useEffect(() => {
    const newLandmarks = generateLandmarks(currentRoute)
    setLandmarks(newLandmarks)
  }, [currentRoute])

  // Generate track on mount and when route changes
  useEffect(() => {
    const track = trackGenerator.generateTrack(currentRoute)

    // If we're in the middle of a route (position > 0), store as pending
    // Only apply new track when position resets to beginning (< 0)
    if (trainPosition > 0 && previousRouteRef.current !== currentRoute) {
      setPendingTrackData(track)
    } else {
      setTrackData(track)
      previousRouteRef.current = currentRoute
      setPendingTrackData(null)
    }
  }, [trackGenerator, currentRoute, trainPosition])

  // Apply pending track when train resets to beginning
  useEffect(() => {
    if (pendingTrackData && trainPosition < 0) {
      setTrackData(pendingTrackData)
      previousRouteRef.current = currentRoute
      setPendingTrackData(null)
    }
  }, [pendingTrackData, trainPosition, currentRoute])

  // Manage passenger display during route transitions
  useEffect(() => {
    // Calculate the position of the last train car
    const lastCarPosition = trainPosition - maxCars * carSpacing
    const fadeOutEnd = 97 // Position where cars are fully faded out

    // Only switch to new passengers when:
    // 1. Train has reset to start position (< 0), OR
    // 2. All cars (including the last one) have exited (last car position >= fadeOutEnd)
    const allCarsExited = lastCarPosition >= fadeOutEnd
    const trainReset = trainPosition < 0

    if (trainReset || allCarsExited || passengers === previousPassengersRef.current) {
      setDisplayPassengers(passengers)
      previousPassengersRef.current = passengers
    }
    // Otherwise, if we're mid-route and passengers changed, keep showing old passengers
    else if (passengers !== previousPassengersRef.current) {
      // Keep displaying old passengers until all cars exit
      // Don't update displayPassengers yet
    }
  }, [passengers, trainPosition, maxCars, carSpacing])

  // Update display passengers during gameplay (same route)
  useEffect(() => {
    // Only update if we're in the same route (not transitioning)
    if (previousRouteRef.current === currentRoute && trainPosition >= 0 && trainPosition < 100) {
      setDisplayPassengers(passengers)
    }
  }, [passengers, currentRoute, trainPosition])

  // Generate ties and rails when path is ready
  useEffect(() => {
    if (pathRef.current && trackData) {
      const result = trackGenerator.generateTiesAndRails(pathRef.current)
      setTiesAndRails(result)
    }
  }, [trackData, trackGenerator, pathRef])

  // Calculate station positions when path is ready
  useEffect(() => {
    if (pathRef.current) {
      const positions = stations.map(station => {
        const pathLength = pathRef.current!.getTotalLength()
        const distance = (station.position / 100) * pathLength
        const point = pathRef.current!.getPointAtLength(distance)
        return { x: point.x, y: point.y }
      })
      setStationPositions(positions)
    }
  }, [trackData, stations, pathRef])

  // Calculate landmark positions when path is ready
  useEffect(() => {
    if (pathRef.current && landmarks.length > 0) {
      const positions = landmarks.map(landmark => {
        const pathLength = pathRef.current!.getTotalLength()
        const distance = (landmark.position / 100) * pathLength
        const point = pathRef.current!.getPointAtLength(distance)
        return {
          x: point.x + landmark.offset.x,
          y: point.y + landmark.offset.y
        }
      })
      setLandmarkPositions(positions)
    }
  }, [trackData, landmarks, pathRef])

  return {
    trackData,
    tiesAndRails,
    stationPositions,
    landmarks,
    landmarkPositions,
    displayPassengers
  }
}
