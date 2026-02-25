import type { ConstructionElement, AngleSpec } from '../types'
import { BYRNE } from '../types'

export type FoundationCategory = 'definitions' | 'postulates' | 'common-notions'

export interface FoundationDiagram {
  id: string
  title: string
  elements: ConstructionElement[]
  equalSegmentGroups?: Array<Array<{ fromId: string; toId: string }>>
  givenAngles?: Array<{ spec: AngleSpec; color: string }>
  equalAngles?: Array<[AngleSpec, AngleSpec]>
  arcOverlays?: Array<{
    centerId: string
    radiusPointId: string
    startAngle: number
    endAngle: number
    color?: string
    lineWidth?: number
    counterClockwise?: boolean
  }>
  animation?:
    | { type: 'line-draw'; fromId: string; toId: string; durationMs?: number }
    | { type: 'circle-sweep'; centerId: string; radiusPointId: string; durationMs?: number }
    | { type: 'pulse-point'; pointIds: string[]; durationMs?: number }
}

export interface FoundationItem {
  id: string
  category: FoundationCategory
  label: string
  title: string
  statement: string
  plain: string
  diagramId: string
}

const pt = (
  id: string,
  x: number,
  y: number,
  label: string,
  color: string = BYRNE.given
): ConstructionElement => ({
  kind: 'point',
  id,
  x,
  y,
  label,
  color,
  origin: 'given',
})

const seg = (
  id: string,
  fromId: string,
  toId: string,
  color: string = BYRNE.given
): ConstructionElement => ({
  kind: 'segment',
  id,
  fromId,
  toId,
  color,
  origin: 'given',
})

const circle = (
  id: string,
  centerId: string,
  radiusPointId: string,
  color: string = BYRNE.blue
): ConstructionElement => ({
  kind: 'circle',
  id,
  centerId,
  radiusPointId,
  color,
  origin: 'compass',
})

const red = BYRNE.red
const blue = BYRNE.blue
const yellow = BYRNE.yellow
const ink = BYRNE.given

export const FOUNDATION_DIAGRAMS: Record<string, FoundationDiagram> = {
  'def-1': {
    id: 'def-1',
    title: 'Point',
    elements: [pt('pt-A', 0, 0, 'A', red)],
    animation: { type: 'pulse-point', pointIds: ['pt-A'], durationMs: 2200 },
  },
  'def-2': {
    id: 'def-2',
    title: 'Line',
    elements: [pt('pt-A', -2, 0, 'A'), pt('pt-B', 2, 0, 'B'), seg('seg-AB', 'pt-A', 'pt-B')],
  },
  'def-3': {
    id: 'def-3',
    title: 'Ends of a Line',
    elements: [pt('pt-A', -2, 0, 'A', red), pt('pt-B', 2, 0, 'B', red), seg('seg-AB', 'pt-A', 'pt-B')],
  },
  'def-4': {
    id: 'def-4',
    title: 'Straight Line',
    elements: [pt('pt-A', -2, 0, 'A'), pt('pt-B', 2, 0, 'B'), seg('seg-AB', 'pt-A', 'pt-B', blue)],
  },
  'def-5': {
    id: 'def-5',
    title: 'Surface',
    elements: [
      pt('pt-A', -2.4, -0.9, 'A'),
      pt('pt-B', 1.6, -1.2, 'B'),
      pt('pt-C', 2.2, 0.8, 'C'),
      pt('pt-D', -2.0, 1.1, 'D'),
      seg('seg-AB', 'pt-A', 'pt-B'),
      seg('seg-BC', 'pt-B', 'pt-C'),
      seg('seg-CD', 'pt-C', 'pt-D'),
      seg('seg-DA', 'pt-D', 'pt-A'),
    ],
  },
  'def-6': {
    id: 'def-6',
    title: 'Edges of a Surface',
    elements: [
      pt('pt-A', -2.4, -0.9, 'A'),
      pt('pt-B', 1.6, -1.2, 'B'),
      pt('pt-C', 2.2, 0.8, 'C'),
      pt('pt-D', -2.0, 1.1, 'D'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-BC', 'pt-B', 'pt-C', blue),
      seg('seg-CD', 'pt-C', 'pt-D', blue),
      seg('seg-DA', 'pt-D', 'pt-A', blue),
    ],
  },
  'def-7': {
    id: 'def-7',
    title: 'Plane Surface',
    elements: [
      pt('pt-A', -2, -1, 'A'),
      pt('pt-B', 2, -1, 'B'),
      pt('pt-C', 2, 1, 'C'),
      pt('pt-D', -2, 1, 'D'),
      pt('pt-E', -1, 0, 'E', yellow),
      pt('pt-F', 1, 0, 'F', yellow),
      seg('seg-AB', 'pt-A', 'pt-B'),
      seg('seg-BC', 'pt-B', 'pt-C'),
      seg('seg-CD', 'pt-C', 'pt-D'),
      seg('seg-DA', 'pt-D', 'pt-A'),
      seg('seg-EF', 'pt-E', 'pt-F', yellow),
    ],
  },
  'def-8': {
    id: 'def-8',
    title: 'Plane Angle',
    elements: [
      pt('pt-A', 0, 0, 'A'),
      pt('pt-B', 2, 0, 'B'),
      pt('pt-C', 0, 2, 'C'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-AC', 'pt-A', 'pt-C', red),
    ],
  },
  'def-9': {
    id: 'def-9',
    title: 'Rectilinear Angle',
    elements: [
      pt('pt-A', 0, 0, 'A'),
      pt('pt-B', 2, 0, 'B'),
      pt('pt-C', 0, 2, 'C'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-AC', 'pt-A', 'pt-C', red),
    ],
  },
  'def-10': {
    id: 'def-10',
    title: 'Right Angle',
    elements: [
      pt('pt-A', 0, 0, 'A'),
      pt('pt-B', 2, 0, 'B'),
      pt('pt-C', 0, 2, 'C'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-AC', 'pt-A', 'pt-C', blue),
    ],
  },
  'def-11': {
    id: 'def-11',
    title: 'Obtuse Angle',
    elements: [
      pt('pt-A', 0, 0, 'A'),
      pt('pt-B', 2, 0, 'B'),
      pt('pt-C', -1, 1.5, 'C'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-AC', 'pt-A', 'pt-C', red),
    ],
  },
  'def-12': {
    id: 'def-12',
    title: 'Acute Angle',
    elements: [
      pt('pt-A', 0, 0, 'A'),
      pt('pt-B', 2, 0, 'B'),
      pt('pt-C', 1, 1.2, 'C'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-AC', 'pt-A', 'pt-C', red),
    ],
  },
  'def-13': {
    id: 'def-13',
    title: 'Boundary',
    elements: [
      pt('pt-A', -2, -1, 'A'),
      pt('pt-B', 2, -1, 'B'),
      pt('pt-C', 2, 1, 'C'),
      pt('pt-D', -2, 1, 'D'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-BC', 'pt-B', 'pt-C', blue),
      seg('seg-CD', 'pt-C', 'pt-D', blue),
      seg('seg-DA', 'pt-D', 'pt-A', blue),
    ],
  },
  'def-14': {
    id: 'def-14',
    title: 'Figure',
    elements: [
      pt('pt-A', -1.5, -0.8, 'A'),
      pt('pt-B', 1.5, -0.8, 'B'),
      pt('pt-C', 0, 1.4, 'C'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-BC', 'pt-B', 'pt-C', blue),
      seg('seg-CA', 'pt-C', 'pt-A', blue),
    ],
  },
  'def-15': {
    id: 'def-15',
    title: 'Circle',
    elements: [
      pt('pt-O', 0, 0, 'O', red),
      pt('pt-A', 2, 0, 'A', red),
      seg('seg-OA', 'pt-O', 'pt-A', red),
      circle('cir-1', 'pt-O', 'pt-A', blue),
    ],
    animation: { type: 'circle-sweep', centerId: 'pt-O', radiusPointId: 'pt-A', durationMs: 2600 },
  },
  'def-16': {
    id: 'def-16',
    title: 'Center',
    elements: [
      pt('pt-O', 0, 0, 'O', red),
      pt('pt-A', 2, 0, 'A', red),
      circle('cir-1', 'pt-O', 'pt-A', blue),
    ],
    animation: { type: 'pulse-point', pointIds: ['pt-O'], durationMs: 2400 },
  },
  'def-17': {
    id: 'def-17',
    title: 'Diameter',
    elements: [
      pt('pt-O', 0, 0, 'O', red),
      pt('pt-A', -2, 0, 'A'),
      pt('pt-B', 2, 0, 'B'),
      seg('seg-AB', 'pt-A', 'pt-B', red),
      circle('cir-1', 'pt-O', 'pt-B', blue),
    ],
  },
  'def-18': {
    id: 'def-18',
    title: 'Semicircle',
    elements: [
      pt('pt-O', 0, 0, 'O', red),
      pt('pt-A', -2, 0, 'A'),
      pt('pt-B', 2, 0, 'B'),
      seg('seg-AB', 'pt-A', 'pt-B', red),
      circle('cir-1', 'pt-O', 'pt-B', blue),
    ],
    arcOverlays: [
      {
        centerId: 'pt-O',
        radiusPointId: 'pt-B',
        startAngle: Math.PI,
        endAngle: 0,
        counterClockwise: true,
        color: blue,
        lineWidth: 2.5,
      },
    ],
  },
  'def-19': {
    id: 'def-19',
    title: 'Rectilinear Figures',
    elements: [
      // triangle
      pt('pt-A', -4, -0.8, 'A'),
      pt('pt-B', -2, -0.8, 'B'),
      pt('pt-C', -3, 1.2, 'C'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-BC', 'pt-B', 'pt-C', blue),
      seg('seg-CA', 'pt-C', 'pt-A', blue),
      // quadrilateral
      pt('pt-D', -0.8, -0.8, 'D'),
      pt('pt-E', 1.2, -0.8, 'E'),
      pt('pt-F', 1.4, 1.0, 'F'),
      pt('pt-G', -1.0, 1.0, 'G'),
      seg('seg-DE', 'pt-D', 'pt-E', red),
      seg('seg-EF', 'pt-E', 'pt-F', red),
      seg('seg-FG', 'pt-F', 'pt-G', red),
      seg('seg-GD', 'pt-G', 'pt-D', red),
      // multilateral (pentagon)
      pt('pt-H', 3.2, -0.6, 'H'),
      pt('pt-I', 4.5, -0.2, 'I'),
      pt('pt-J', 4.2, 1.2, 'J'),
      pt('pt-K', 3.0, 1.2, 'K'),
      pt('pt-L', 2.6, 0.2, 'L'),
      seg('seg-HI', 'pt-H', 'pt-I', yellow),
      seg('seg-IJ', 'pt-I', 'pt-J', yellow),
      seg('seg-JK', 'pt-J', 'pt-K', yellow),
      seg('seg-KL', 'pt-K', 'pt-L', yellow),
      seg('seg-LH', 'pt-L', 'pt-H', yellow),
    ],
  },
  'def-20': {
    id: 'def-20',
    title: 'Triangle Types by Sides',
    elements: [
      // equilateral
      pt('pt-A', -4, -1, 'A'),
      pt('pt-B', -2, -1, 'B'),
      pt('pt-C', -3, 1, 'C'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-BC', 'pt-B', 'pt-C', blue),
      seg('seg-CA', 'pt-C', 'pt-A', blue),
      // isosceles
      pt('pt-D', -0.5, -1, 'D'),
      pt('pt-E', 1.5, -1, 'E'),
      pt('pt-F', 0.5, 1.2, 'F'),
      seg('seg-DE', 'pt-D', 'pt-E', red),
      seg('seg-EF', 'pt-E', 'pt-F', red),
      seg('seg-FD', 'pt-F', 'pt-D', yellow),
      // scalene
      pt('pt-G', 2.8, -1, 'G'),
      pt('pt-H', 4.8, -0.6, 'H'),
      pt('pt-I', 3.8, 1.0, 'I'),
      seg('seg-GH', 'pt-G', 'pt-H', blue),
      seg('seg-HI', 'pt-H', 'pt-I', red),
      seg('seg-IG', 'pt-I', 'pt-G', yellow),
    ],
    equalSegmentGroups: [
      [
        { fromId: 'pt-A', toId: 'pt-B' },
        { fromId: 'pt-B', toId: 'pt-C' },
        { fromId: 'pt-C', toId: 'pt-A' },
      ],
      [
        { fromId: 'pt-D', toId: 'pt-F' },
        { fromId: 'pt-E', toId: 'pt-F' },
      ],
    ],
  },
  'def-21': {
    id: 'def-21',
    title: 'Triangle Types by Angles',
    elements: [
      // right triangle
      pt('pt-A', -4, -1, 'A'),
      pt('pt-B', -2, -1, 'B'),
      pt('pt-C', -4, 1, 'C'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-AC', 'pt-A', 'pt-C', blue),
      seg('seg-BC', 'pt-B', 'pt-C', blue),
      // obtuse triangle
      pt('pt-D', -0.5, -1, 'D'),
      pt('pt-E', 1.8, -0.4, 'E'),
      pt('pt-F', -0.2, 1.2, 'F'),
      seg('seg-DE', 'pt-D', 'pt-E', red),
      seg('seg-EF', 'pt-E', 'pt-F', red),
      seg('seg-FD', 'pt-F', 'pt-D', red),
      // acute triangle
      pt('pt-G', 3.0, -1, 'G'),
      pt('pt-H', 4.8, -0.6, 'H'),
      pt('pt-I', 4.0, 1.0, 'I'),
      seg('seg-GH', 'pt-G', 'pt-H', yellow),
      seg('seg-HI', 'pt-H', 'pt-I', yellow),
      seg('seg-IG', 'pt-I', 'pt-G', yellow),
    ],
  },
  'def-22': {
    id: 'def-22',
    title: 'Quadrilateral Types',
    elements: [
      // square
      pt('pt-A', -4.5, -1, 'A'),
      pt('pt-B', -3.0, -1, 'B'),
      pt('pt-C', -3.0, 0.5, 'C'),
      pt('pt-D', -4.5, 0.5, 'D'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-BC', 'pt-B', 'pt-C', blue),
      seg('seg-CD', 'pt-C', 'pt-D', blue),
      seg('seg-DA', 'pt-D', 'pt-A', blue),
      // oblong
      pt('pt-E', -1.8, -1, 'E'),
      pt('pt-F', 0.2, -1, 'F'),
      pt('pt-G', 0.2, 0.4, 'G'),
      pt('pt-H', -1.8, 0.4, 'H'),
      seg('seg-EF', 'pt-E', 'pt-F', red),
      seg('seg-FG', 'pt-F', 'pt-G', red),
      seg('seg-GH', 'pt-G', 'pt-H', red),
      seg('seg-HE', 'pt-H', 'pt-E', red),
      // rhombus
      pt('pt-I', 1.8, -0.8, 'I'),
      pt('pt-J', 3.4, -0.2, 'J'),
      pt('pt-K', 1.8, 0.6, 'K'),
      pt('pt-L', 0.2, -0.2, 'L'),
      seg('seg-IJ', 'pt-I', 'pt-J', yellow),
      seg('seg-JK', 'pt-J', 'pt-K', yellow),
      seg('seg-KL', 'pt-K', 'pt-L', yellow),
      seg('seg-LI', 'pt-L', 'pt-I', yellow),
      // rhomboid / trapezia
      pt('pt-M', 4.4, -0.9, 'M'),
      pt('pt-N', 6.0, -0.4, 'N'),
      pt('pt-O', 5.4, 0.6, 'O'),
      pt('pt-P', 3.8, 0.1, 'P'),
      seg('seg-MN', 'pt-M', 'pt-N', ink),
      seg('seg-NO', 'pt-N', 'pt-O', ink),
      seg('seg-OP', 'pt-O', 'pt-P', ink),
      seg('seg-PM', 'pt-P', 'pt-M', ink),
    ],
    equalSegmentGroups: [
      [
        { fromId: 'pt-A', toId: 'pt-B' },
        { fromId: 'pt-B', toId: 'pt-C' },
        { fromId: 'pt-C', toId: 'pt-D' },
        { fromId: 'pt-D', toId: 'pt-A' },
      ],
      [
        { fromId: 'pt-I', toId: 'pt-J' },
        { fromId: 'pt-J', toId: 'pt-K' },
        { fromId: 'pt-K', toId: 'pt-L' },
        { fromId: 'pt-L', toId: 'pt-I' },
      ],
      [
        { fromId: 'pt-M', toId: 'pt-N' },
        { fromId: 'pt-O', toId: 'pt-P' },
      ],
      [
        { fromId: 'pt-N', toId: 'pt-O' },
        { fromId: 'pt-P', toId: 'pt-M' },
      ],
    ],
    givenAngles: [
      { spec: { vertex: 'pt-A', ray1End: 'pt-B', ray2End: 'pt-D' }, color: blue },
      { spec: { vertex: 'pt-B', ray1End: 'pt-C', ray2End: 'pt-A' }, color: blue },
      { spec: { vertex: 'pt-E', ray1End: 'pt-F', ray2End: 'pt-H' }, color: red },
      { spec: { vertex: 'pt-F', ray1End: 'pt-G', ray2End: 'pt-E' }, color: red },
    ],
    equalAngles: [
      [
        { vertex: 'pt-A', ray1End: 'pt-B', ray2End: 'pt-D' },
        { vertex: 'pt-B', ray1End: 'pt-C', ray2End: 'pt-A' },
      ],
      [
        { vertex: 'pt-E', ray1End: 'pt-F', ray2End: 'pt-H' },
        { vertex: 'pt-F', ray1End: 'pt-G', ray2End: 'pt-E' },
      ],
    ],
  },
  'def-23': {
    id: 'def-23',
    title: 'Parallel Lines',
    elements: [
      pt('pt-A', -2.5, -0.8, 'A'),
      pt('pt-B', 2.5, -0.8, 'B'),
      pt('pt-C', -2.5, 0.8, 'C'),
      pt('pt-D', 2.5, 0.8, 'D'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-CD', 'pt-C', 'pt-D', blue),
    ],
  },
  'post-1': {
    id: 'post-1',
    title: 'Draw a Line',
    elements: [pt('pt-A', -2, 0, 'A', red), pt('pt-B', 2, 0, 'B', red), seg('seg-AB', 'pt-A', 'pt-B', blue)],
    animation: { type: 'line-draw', fromId: 'pt-A', toId: 'pt-B', durationMs: 2000 },
  },
  'post-2': {
    id: 'post-2',
    title: 'Extend a Line',
    elements: [
      pt('pt-A', -3, 0, 'A', red),
      pt('pt-B', 0, 0, 'B', red),
      pt('pt-C', 3, 0, 'C', red),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-BC', 'pt-B', 'pt-C', blue),
    ],
    animation: { type: 'line-draw', fromId: 'pt-A', toId: 'pt-C', durationMs: 2200 },
  },
  'post-3': {
    id: 'post-3',
    title: 'Draw a Circle',
    elements: [
      pt('pt-A', 0, 0, 'A', red),
      pt('pt-B', 2, 0, 'B', red),
      seg('seg-AB', 'pt-A', 'pt-B', red),
      circle('cir-1', 'pt-A', 'pt-B', blue),
    ],
    animation: { type: 'circle-sweep', centerId: 'pt-A', radiusPointId: 'pt-B', durationMs: 2400 },
  },
  'post-4': {
    id: 'post-4',
    title: 'Right Angles Are Equal',
    elements: [
      pt('pt-A', -2, 0, 'A'),
      pt('pt-B', -0.8, 0, 'B'),
      pt('pt-C', -2, 1.2, 'C'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-AC', 'pt-A', 'pt-C', blue),
      pt('pt-D', 1.2, 0, 'D'),
      pt('pt-E', 2.4, 0, 'E'),
      pt('pt-F', 1.2, 1.2, 'F'),
      seg('seg-DE', 'pt-D', 'pt-E', red),
      seg('seg-DF', 'pt-D', 'pt-F', red),
    ],
    givenAngles: [
      { spec: { vertex: 'pt-A', ray1End: 'pt-B', ray2End: 'pt-C' }, color: blue },
      { spec: { vertex: 'pt-D', ray1End: 'pt-E', ray2End: 'pt-F' }, color: red },
    ],
    equalAngles: [
      [
        { vertex: 'pt-A', ray1End: 'pt-B', ray2End: 'pt-C' },
        { vertex: 'pt-D', ray1End: 'pt-E', ray2End: 'pt-F' },
      ],
    ],
  },
  'post-5': {
    id: 'post-5',
    title: 'Parallel Postulate',
    elements: [
      pt('pt-A', -3, -0.8, 'A'),
      pt('pt-B', 3, -0.8, 'B'),
      pt('pt-C', -3, 0.8, 'C'),
      pt('pt-D', 3, 0.8, 'D'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-CD', 'pt-C', 'pt-D', blue),
      pt('pt-E', -1.2, -1.2, 'E'),
      pt('pt-F', 1.2, 1.2, 'F'),
      seg('seg-EF', 'pt-E', 'pt-F', red),
    ],
  },
  'cn-1': {
    id: 'cn-1',
    title: 'Transitivity',
    elements: [
      pt('pt-A', -4, 0, 'A'),
      pt('pt-B', -2, 0, 'B'),
      pt('pt-C', -0.2, 0, 'C'),
      pt('pt-D', 1.8, 0, 'D'),
      pt('pt-E', 3.6, 0, 'E'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-BC', 'pt-B', 'pt-C', blue),
      seg('seg-CD', 'pt-C', 'pt-D', blue),
      seg('seg-DE', 'pt-D', 'pt-E', blue),
    ],
    equalSegmentGroups: [
      [
        { fromId: 'pt-A', toId: 'pt-B' },
        { fromId: 'pt-C', toId: 'pt-D' },
      ],
      [
        { fromId: 'pt-B', toId: 'pt-C' },
        { fromId: 'pt-D', toId: 'pt-E' },
      ],
    ],
  },
  'cn-2': {
    id: 'cn-2',
    title: 'Addition of Equals',
    elements: [
      pt('pt-A', -4, 0, 'A'),
      pt('pt-B', -2, 0, 'B'),
      pt('pt-C', -0.5, 0, 'C'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-BC', 'pt-B', 'pt-C', red),
      pt('pt-D', 0.8, 0, 'D'),
      pt('pt-E', 2.8, 0, 'E'),
      pt('pt-F', 4.3, 0, 'F'),
      seg('seg-DE', 'pt-D', 'pt-E', blue),
      seg('seg-EF', 'pt-E', 'pt-F', red),
    ],
    equalSegmentGroups: [
      [
        { fromId: 'pt-A', toId: 'pt-B' },
        { fromId: 'pt-D', toId: 'pt-E' },
      ],
      [
        { fromId: 'pt-B', toId: 'pt-C' },
        { fromId: 'pt-E', toId: 'pt-F' },
      ],
    ],
  },
  'cn-3': {
    id: 'cn-3',
    title: 'Subtraction of Equals',
    elements: [
      pt('pt-A', -4, 0, 'A'),
      pt('pt-B', -1.5, 0, 'B'),
      pt('pt-C', 0.5, 0, 'C'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-BC', 'pt-B', 'pt-C', red),
      pt('pt-D', 2.0, 0, 'D'),
      pt('pt-E', 4.5, 0, 'E'),
      pt('pt-F', 6.5, 0, 'F'),
      seg('seg-DE', 'pt-D', 'pt-E', blue),
      seg('seg-EF', 'pt-E', 'pt-F', red),
    ],
    equalSegmentGroups: [
      [
        { fromId: 'pt-A', toId: 'pt-B' },
        { fromId: 'pt-D', toId: 'pt-E' },
      ],
      [
        { fromId: 'pt-B', toId: 'pt-C' },
        { fromId: 'pt-E', toId: 'pt-F' },
      ],
    ],
  },
  'cn-4': {
    id: 'cn-4',
    title: 'Coincidence',
    elements: [
      pt('pt-A', -1.4, -0.8, 'A'),
      pt('pt-B', 1.4, -0.8, 'B'),
      pt('pt-C', 0, 1.4, 'C'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-BC', 'pt-B', 'pt-C', blue),
      seg('seg-CA', 'pt-C', 'pt-A', blue),
      pt('pt-D', -1.1, -0.6, 'D'),
      pt('pt-E', 1.1, -0.6, 'E'),
      pt('pt-F', 0, 1.2, 'F'),
      seg('seg-DE', 'pt-D', 'pt-E', red),
      seg('seg-EF', 'pt-E', 'pt-F', red),
      seg('seg-FD', 'pt-F', 'pt-D', red),
    ],
  },
  'cn-5': {
    id: 'cn-5',
    title: 'Whole Greater Than Part',
    elements: [
      pt('pt-A', -4, 0, 'A'),
      pt('pt-B', 2, 0, 'B'),
      pt('pt-C', 3.5, 0, 'C'),
      seg('seg-AB', 'pt-A', 'pt-B', blue),
      seg('seg-BC', 'pt-B', 'pt-C', red),
    ],
  },
}

export const FOUNDATION_ITEMS: FoundationItem[] = [
  {
    id: 'def-1',
    category: 'definitions',
    label: 'Def. 1',
    title: 'Point',
    statement: 'A point is that which has no part.',
    plain: 'A point is just a location with no size.',
    diagramId: 'def-1',
  },
  {
    id: 'def-2',
    category: 'definitions',
    label: 'Def. 2',
    title: 'Line',
    statement: 'A line is breadthless length.',
    plain: 'A line has length but no thickness.',
    diagramId: 'def-2',
  },
  {
    id: 'def-3',
    category: 'definitions',
    label: 'Def. 3',
    title: 'Ends of a Line',
    statement: 'The ends of a line are points.',
    plain: 'A line starts and ends at points.',
    diagramId: 'def-3',
  },
  {
    id: 'def-4',
    category: 'definitions',
    label: 'Def. 4',
    title: 'Straight Line',
    statement: 'A straight line is a line which lies evenly with the points on itself.',
    plain: 'A straight line does not bend.',
    diagramId: 'def-4',
  },
  {
    id: 'def-5',
    category: 'definitions',
    label: 'Def. 5',
    title: 'Surface',
    statement: 'A surface is that which has length and breadth only.',
    plain: 'A surface is flat and has only length and width.',
    diagramId: 'def-5',
  },
  {
    id: 'def-6',
    category: 'definitions',
    label: 'Def. 6',
    title: 'Edges of a Surface',
    statement: 'The edges of a surface are lines.',
    plain: 'The boundary of a surface is made of lines.',
    diagramId: 'def-6',
  },
  {
    id: 'def-7',
    category: 'definitions',
    label: 'Def. 7',
    title: 'Plane Surface',
    statement: 'A plane surface is a surface which lies evenly with the straight lines on itself.',
    plain: 'A plane is a perfectly flat surface.',
    diagramId: 'def-7',
  },
  {
    id: 'def-8',
    category: 'definitions',
    label: 'Def. 8',
    title: 'Plane Angle',
    statement:
      'A plane angle is the inclination to one another of two lines in a plane which meet one another and do not lie in a straight line.',
    plain: 'An angle is the opening between two lines that meet.',
    diagramId: 'def-8',
  },
  {
    id: 'def-9',
    category: 'definitions',
    label: 'Def. 9',
    title: 'Rectilinear Angle',
    statement:
      'And when the lines containing the angle are straight, the angle is called rectilinear.',
    plain: 'If the sides are straight lines, the angle is rectilinear.',
    diagramId: 'def-9',
  },
  {
    id: 'def-10',
    category: 'definitions',
    label: 'Def. 10',
    title: 'Right Angle / Perpendicular',
    statement:
      'When a straight line standing on a straight line makes the adjacent angles equal to one another, each of the equal angles is right, and the straight line standing on the other is called a perpendicular to that on which it stands.',
    plain: 'If two adjacent angles are equal, each is a right angle; the standing line is perpendicular.',
    diagramId: 'def-10',
  },
  {
    id: 'def-11',
    category: 'definitions',
    label: 'Def. 11',
    title: 'Obtuse Angle',
    statement: 'An obtuse angle is an angle greater than a right angle.',
    plain: 'An obtuse angle is bigger than a right angle.',
    diagramId: 'def-11',
  },
  {
    id: 'def-12',
    category: 'definitions',
    label: 'Def. 12',
    title: 'Acute Angle',
    statement: 'An acute angle is an angle less than a right angle.',
    plain: 'An acute angle is smaller than a right angle.',
    diagramId: 'def-12',
  },
  {
    id: 'def-13',
    category: 'definitions',
    label: 'Def. 13',
    title: 'Boundary',
    statement: 'A boundary is that which is an extremity of anything.',
    plain: 'A boundary is an edge or end.',
    diagramId: 'def-13',
  },
  {
    id: 'def-14',
    category: 'definitions',
    label: 'Def. 14',
    title: 'Figure',
    statement: 'A figure is that which is contained by any boundary or boundaries.',
    plain: 'A figure is a shape enclosed by boundaries.',
    diagramId: 'def-14',
  },
  {
    id: 'def-15',
    category: 'definitions',
    label: 'Def. 15',
    title: 'Circle',
    statement:
      'A circle is a plane figure contained by one line such that all the straight lines falling upon it from one point among those lying within the figure equal one another.',
    plain: 'A circle is all points the same distance from a center.',
    diagramId: 'def-15',
  },
  {
    id: 'def-16',
    category: 'definitions',
    label: 'Def. 16',
    title: 'Center',
    statement: 'And the point is called the center of the circle.',
    plain: 'That point is the center of the circle.',
    diagramId: 'def-16',
  },
  {
    id: 'def-17',
    category: 'definitions',
    label: 'Def. 17',
    title: 'Diameter',
    statement:
      'A diameter of the circle is any straight line drawn through the center and terminated in both directions by the circumference of the circle, and such a straight line also bisects the circle.',
    plain: 'A diameter goes through the center and cuts the circle in two.',
    diagramId: 'def-17',
  },
  {
    id: 'def-18',
    category: 'definitions',
    label: 'Def. 18',
    title: 'Semicircle',
    statement:
      'A semicircle is the figure contained by the diameter and the circumference cut off by it.',
    plain: 'A semicircle is half a circle, bounded by a diameter.',
    diagramId: 'def-18',
  },
  {
    id: 'def-19',
    category: 'definitions',
    label: 'Def. 19',
    title: 'Rectilinear Figures',
    statement:
      'Rectilinear figures are those which are contained by straight lines, trilateral figures those contained by three, quadrilateral those contained by four, and multilateral those contained by more than four straight lines.',
    plain: 'Rectilinear figures use straight sides: 3 for triangles, 4 for quadrilaterals, more for multilateral.',
    diagramId: 'def-19',
  },
  {
    id: 'def-20',
    category: 'definitions',
    label: 'Def. 20',
    title: 'Triangles by Sides',
    statement:
      'Of trilateral figures, an equilateral triangle is that which has its three sides equal, an isosceles triangle that which has two of its sides equal, and a scalene triangle that which has its three sides unequal.',
    plain: 'Equilateral has 3 equal sides, isosceles has 2 equal sides, scalene has no equal sides.',
    diagramId: 'def-20',
  },
  {
    id: 'def-21',
    category: 'definitions',
    label: 'Def. 21',
    title: 'Triangles by Angles',
    statement:
      'Further, of trilateral figures, a right-angled triangle is that which has a right angle, an obtuse-angled triangle that which has an obtuse angle, and an acute-angled triangle that which has its three angles acute.',
    plain: 'Triangles can be right, obtuse, or acute by their angles.',
    diagramId: 'def-21',
  },
  {
    id: 'def-22',
    category: 'definitions',
    label: 'Def. 22',
    title: 'Quadrilateral Types',
    statement:
      'Of quadrilateral figures, a square is that which is both equilateral and right-angled; and an oblong that which is right-angled but not equilateral; a rhombus that which is equilateral but not right-angled; and a rhomboid that which has its opposite sides and angles equal to one another but is neither equilateral nor right-angled. And let quadrilaterals other than these be called trapezia.',
    plain: 'Quadrilaterals include square, oblong, rhombus, rhomboid, and other trapezia.',
    diagramId: 'def-22',
  },
  {
    id: 'def-23',
    category: 'definitions',
    label: 'Def. 23',
    title: 'Parallel Lines',
    statement:
      'Parallel straight lines are straight lines which, being in the same plane and being produced indefinitely in both directions, do not meet one another in either direction.',
    plain: 'Parallel lines in the same plane never meet.',
    diagramId: 'def-23',
  },
  {
    id: 'post-1',
    category: 'postulates',
    label: 'Post. 1',
    title: 'Draw a Line',
    statement: 'To draw a straight line from any point to any point.',
    plain: 'You can draw a straight line between any two points.',
    diagramId: 'post-1',
  },
  {
    id: 'post-2',
    category: 'postulates',
    label: 'Post. 2',
    title: 'Extend a Line',
    statement: 'To produce a finite straight line continuously in a straight line.',
    plain: 'You can extend a straight line in the same direction.',
    diagramId: 'post-2',
  },
  {
    id: 'post-3',
    category: 'postulates',
    label: 'Post. 3',
    title: 'Draw a Circle',
    statement: 'To describe a circle with any center and radius.',
    plain: 'You can draw a circle with any center and radius.',
    diagramId: 'post-3',
  },
  {
    id: 'post-4',
    category: 'postulates',
    label: 'Post. 4',
    title: 'Right Angles Are Equal',
    statement: 'That all right angles equal one another.',
    plain: 'All right angles are the same size.',
    diagramId: 'post-4',
  },
  {
    id: 'post-5',
    category: 'postulates',
    label: 'Post. 5',
    title: 'Parallel Postulate',
    statement:
      'That, if a straight line falling on two straight lines makes the interior angles on the same side less than two right angles, the two straight lines, if produced indefinitely, meet on that side on which are the angles less than the two right angles.',
    plain: 'If the interior angles are less than two right angles, the lines meet on that side.',
    diagramId: 'post-5',
  },
  {
    id: 'cn-1',
    category: 'common-notions',
    label: 'C.N. 1',
    title: 'Transitivity of Equality',
    statement: 'Things which equal the same thing also equal one another.',
    plain: 'If two things equal the same thing, they are equal to each other.',
    diagramId: 'cn-1',
  },
  {
    id: 'cn-2',
    category: 'common-notions',
    label: 'C.N. 2',
    title: 'Addition of Equals',
    statement: 'If equals are added to equals, then the wholes are equal.',
    plain: 'Adding the same amount to equals keeps them equal.',
    diagramId: 'cn-2',
  },
  {
    id: 'cn-3',
    category: 'common-notions',
    label: 'C.N. 3',
    title: 'Subtraction of Equals',
    statement: 'If equals are subtracted from equals, then the remainders are equal.',
    plain: 'Subtracting equals from equals leaves equal remainders.',
    diagramId: 'cn-3',
  },
  {
    id: 'cn-4',
    category: 'common-notions',
    label: 'C.N. 4',
    title: 'Coincidence',
    statement: 'Things which coincide with one another equal one another.',
    plain: 'If two things match exactly, they are equal.',
    diagramId: 'cn-4',
  },
  {
    id: 'cn-5',
    category: 'common-notions',
    label: 'C.N. 5',
    title: 'Whole Greater Than Part',
    statement: 'The whole is greater than the part.',
    plain: 'A whole is larger than any of its parts.',
    diagramId: 'cn-5',
  },
]

export const FOUNDATION_CATEGORIES: Array<{ id: FoundationCategory; label: string }> = [
  { id: 'definitions', label: 'Definitions' },
  { id: 'postulates', label: 'Postulates' },
  { id: 'common-notions', label: 'Common Notions' },
]
