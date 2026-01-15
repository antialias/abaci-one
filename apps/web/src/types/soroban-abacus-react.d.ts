declare module "@soroban/abacus-react" {
  export interface AbacusProps {
    value: number;
    style?: string;
    size?: number;
    beadHighlights?: Array<{
      placeValue: number;
      beadType: "earth" | "heaven";
      position?: number;
    }>;
    readonly?: boolean;
    showPlaceValues?: boolean;
    onBeadClick?: (
      placeValue: number,
      beadType: "earth" | "heaven",
      position: number,
    ) => void;
  }

  export const Abacus: React.ComponentType<AbacusProps>;

  export interface BeadPosition {
    placeValue: number;
    beadType: "earth" | "heaven";
    position?: number;
  }

  export interface AbacusState {
    beads: BeadPosition[];
    value: number;
  }

  export function createAbacusState(value: number): AbacusState;
  export function calculateValue(state: AbacusState): number;
  export function addToAbacus(state: AbacusState, amount: number): AbacusState;
  export function resetAbacus(): AbacusState;
}
