/**
 * Shared interface for author-mode tool callbacks.
 *
 * Used by both useEuclidChat (text chat) and useGeometryVoice (voice)
 * to dispatch construction mutations and fact store updates from AI tool calls.
 */

/** Callbacks for author-mode tool dispatch — provided by useAuthorCallbacks. */
export interface AuthorToolCallbacks {
  placePoint: (x: number, y: number, label?: string) => Promise<unknown>
  commitSegment: (fromLabel: string, toLabel: string) => Promise<unknown>
  commitCircle: (centerLabel: string, radiusPointLabel: string) => Promise<unknown>
  commitExtend: (baseLabel: string, throughLabel: string, distance?: number) => Promise<unknown>
  markIntersection: (ofA: string, ofB: string, which?: string) => Promise<unknown>
  commitMacro: (propId: number, inputLabels: string[]) => Promise<unknown>
  addFact: (
    leftA: string,
    leftB: string,
    rightA: string,
    rightB: string,
    citationType: string,
    citationDetail: string | undefined,
    statement: string,
    justification: string
  ) => Promise<unknown>
  addAngleFact: (
    leftVertex: string,
    leftRay1: string,
    leftRay2: string,
    rightVertex: string,
    rightRay1: string,
    rightRay2: string,
    citationType: string,
    citationDetail: string | undefined,
    statement: string,
    justification: string
  ) => Promise<unknown>
  relocatePoint: (label: string, x: number, y: number, force?: boolean) => Promise<unknown>
  undoLast: () => Promise<unknown>
  highlight: (entityType: string, labels: string) => Promise<unknown>
}
