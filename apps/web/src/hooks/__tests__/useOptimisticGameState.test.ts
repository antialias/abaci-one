import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GameMove } from "@/lib/arcade/validation";
import { useOptimisticGameState } from "../useOptimisticGameState";

interface TestGameState {
  value: number;
  moves: number;
}

describe("useOptimisticGameState", () => {
  const initialState: TestGameState = { value: 0, moves: 0 };

  const applyMove = (state: TestGameState, move: GameMove): TestGameState => {
    if (move.type === "INCREMENT") {
      return { value: state.value + 1, moves: state.moves + 1 };
    }
    return state;
  };

  it("should initialize with initial state", () => {
    const { result } = renderHook(() =>
      useOptimisticGameState({
        initialState,
        applyMove,
      }),
    );

    expect(result.current.state).toEqual(initialState);
    expect(result.current.version).toBe(1);
    expect(result.current.hasPendingMoves).toBe(false);
  });

  it("should apply optimistic move immediately", () => {
    const { result } = renderHook(() =>
      useOptimisticGameState({
        initialState,
        applyMove,
      }),
    );

    const move: GameMove = {
      type: "INCREMENT",
      playerId: "test",
      timestamp: Date.now(),
      data: {},
    };

    act(() => {
      result.current.applyOptimisticMove(move);
    });

    expect(result.current.state).toEqual({ value: 1, moves: 1 });
    expect(result.current.hasPendingMoves).toBe(true);
  });

  it("should handle move acceptance from server", () => {
    const { result } = renderHook(() =>
      useOptimisticGameState({
        initialState,
        applyMove,
      }),
    );

    const move: GameMove = {
      type: "INCREMENT",
      playerId: "test",
      timestamp: 123,
      data: {},
    };

    // Apply optimistically
    act(() => {
      result.current.applyOptimisticMove(move);
    });

    expect(result.current.hasPendingMoves).toBe(true);

    // Server accepts
    const serverState: TestGameState = { value: 1, moves: 1 };
    act(() => {
      result.current.handleMoveAccepted(serverState, 2, move);
    });

    expect(result.current.state).toEqual(serverState);
    expect(result.current.version).toBe(2);
    expect(result.current.hasPendingMoves).toBe(false);
  });

  it("should handle move rejection from server", () => {
    const onMoveRejected = vi.fn();
    const { result } = renderHook(() =>
      useOptimisticGameState({
        initialState,
        applyMove,
        onMoveRejected,
      }),
    );

    const move: GameMove = {
      type: "INCREMENT",
      playerId: "test",
      timestamp: 123,
      data: {},
    };

    // Apply optimistically
    act(() => {
      result.current.applyOptimisticMove(move);
    });

    expect(result.current.state).toEqual({ value: 1, moves: 1 });

    // Server rejects
    act(() => {
      result.current.handleMoveRejected("Invalid move", move);
    });

    // Should rollback to initial state
    expect(result.current.state).toEqual(initialState);
    expect(result.current.hasPendingMoves).toBe(false);
    expect(onMoveRejected).toHaveBeenCalledWith("Invalid move", move);
  });

  it("should handle multiple pending moves", () => {
    const { result } = renderHook(() =>
      useOptimisticGameState({
        initialState,
        applyMove,
      }),
    );

    const move1: GameMove = {
      type: "INCREMENT",
      playerId: "test",
      timestamp: 123,
      data: {},
    };

    const move2: GameMove = {
      type: "INCREMENT",
      playerId: "test",
      timestamp: 124,
      data: {},
    };

    // Apply two moves optimistically
    act(() => {
      result.current.applyOptimisticMove(move1);
      result.current.applyOptimisticMove(move2);
    });

    expect(result.current.state).toEqual({ value: 2, moves: 2 });
    expect(result.current.hasPendingMoves).toBe(true);

    // Server accepts first move
    act(() => {
      result.current.handleMoveAccepted({ value: 1, moves: 1 }, 2, move1);
    });

    // Should still have second move pending
    expect(result.current.state).toEqual({ value: 2, moves: 2 });
    expect(result.current.hasPendingMoves).toBe(true);

    // Server accepts second move
    act(() => {
      result.current.handleMoveAccepted({ value: 2, moves: 2 }, 3, move2);
    });

    expect(result.current.state).toEqual({ value: 2, moves: 2 });
    expect(result.current.hasPendingMoves).toBe(false);
  });

  it("should sync with server state", () => {
    const { result } = renderHook(() =>
      useOptimisticGameState({
        initialState,
        applyMove,
      }),
    );

    // Apply some optimistic moves
    act(() => {
      result.current.applyOptimisticMove({
        type: "INCREMENT",
        playerId: "test",
        timestamp: 123,
        data: {},
      });
    });

    expect(result.current.hasPendingMoves).toBe(true);

    // Sync with server (e.g., on reconnect)
    const serverState: TestGameState = { value: 5, moves: 5 };
    act(() => {
      result.current.syncWithServer(serverState, 10);
    });

    expect(result.current.state).toEqual(serverState);
    expect(result.current.version).toBe(10);
    expect(result.current.hasPendingMoves).toBe(false);
  });

  it("should reset to initial state", () => {
    const { result } = renderHook(() =>
      useOptimisticGameState({
        initialState,
        applyMove,
      }),
    );

    // Make some changes
    act(() => {
      result.current.applyOptimisticMove({
        type: "INCREMENT",
        playerId: "test",
        timestamp: 123,
        data: {},
      });
    });

    expect(result.current.state).not.toEqual(initialState);

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toEqual(initialState);
    expect(result.current.version).toBe(1);
    expect(result.current.hasPendingMoves).toBe(false);
  });

  it("should call onMoveAccepted callback", () => {
    const onMoveAccepted = vi.fn();
    const { result } = renderHook(() =>
      useOptimisticGameState({
        initialState,
        applyMove,
        onMoveAccepted,
      }),
    );

    const move: GameMove = {
      type: "INCREMENT",
      playerId: "test",
      timestamp: 123,
      data: {},
    };

    act(() => {
      result.current.applyOptimisticMove(move);
    });

    const serverState: TestGameState = { value: 1, moves: 1 };
    act(() => {
      result.current.handleMoveAccepted(serverState, 2, move);
    });

    expect(onMoveAccepted).toHaveBeenCalledWith(serverState, move);
  });
});
