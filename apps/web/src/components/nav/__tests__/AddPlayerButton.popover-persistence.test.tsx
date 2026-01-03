import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddPlayerButton } from "../AddPlayerButton";

// Track render count to detect re-renders
let invitePlayersRenderCount = 0;
let simulateRoomCreation: (() => void) | null = null;

// Mock InvitePlayersTab to simulate room creation behavior
vi.mock("../InvitePlayersTab", () => ({
  InvitePlayersTab: () => {
    invitePlayersRenderCount++;
    const [status, setStatus] = React.useState<"loading" | "success">(
      "loading",
    );

    React.useEffect(() => {
      // Store the function to trigger room creation
      simulateRoomCreation = () => {
        setStatus("success");
      };

      // Simulate room creation after a delay
      const timer = setTimeout(() => {
        setStatus("success");
      }, 100);

      return () => clearTimeout(timer);
    }, []);

    if (status === "loading") {
      return <div>Creating room...</div>;
    }

    return (
      <div>
        <div>ABC123</div>
        <div>Share Link</div>
      </div>
    );
  },
}));

// Need to import React since we're using it in the mock
import React from "react";

describe("AddPlayerButton - Popover Persistence During Room Creation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset counter
    invitePlayersRenderCount = 0;
    simulateRoomCreation = null;
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>,
    );
  };

  it("keeps popover open when room is created via Invite Players tab", async () => {
    const mockPlayers = [
      { id: "player-1", name: "Player 1", emoji: "😀" },
      { id: "player-2", name: "Player 2", emoji: "😎" },
    ];

    renderWithProviders(
      <AddPlayerButton
        inactivePlayers={mockPlayers}
        shouldEmphasize={true}
        onAddPlayer={vi.fn()}
      />,
    );

    // Step 1: Click the + button to open popover
    const addButton = screen.getByTitle("Add player");
    fireEvent.click(addButton);

    // Step 2: Verify popover is open
    await waitFor(() => {
      expect(screen.getByText("Add Player")).toBeInTheDocument();
      expect(screen.getByText("Invite Players 📨")).toBeInTheDocument();
    });

    // Step 3: Click the "Invite Players" tab
    const inviteTab = screen.getByText("Invite Players 📨");
    fireEvent.click(inviteTab);

    // Step 4: Verify we see the loading state
    await waitFor(() => {
      expect(screen.getByText("Creating room...")).toBeInTheDocument();
    });

    // Step 5: Wait for room creation to complete
    // The mock will update mockIsInRoom to true after 100ms
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    // Step 6: CRITICAL TEST - Verify popover is STILL visible after room creation
    await waitFor(() => {
      // The tab headers should still be visible
      expect(screen.getByText("Add Player")).toBeInTheDocument();
      expect(screen.getByText("Invite Players 📨")).toBeInTheDocument();
      // And we should see the share buttons now
      expect(screen.getByText("ABC123")).toBeInTheDocument();
      expect(screen.getByText("Share Link")).toBeInTheDocument();
    });

    // Step 7: Wait 500ms to see if popover disappears (as reported in browser)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    // Step 8: Verify popover is STILL there after delay
    expect(screen.queryByText("Add Player")).toBeInTheDocument();
    expect(screen.queryByText("Invite Players 📨")).toBeInTheDocument();
    expect(screen.queryByText("ABC123")).toBeInTheDocument();
    expect(screen.queryByText("Share Link")).toBeInTheDocument();

    // Step 9: Verify the popover container is still in the DOM
    const popoverContent = screen
      .getByText("ABC123")
      .closest('div[style*="position: absolute"]');
    expect(popoverContent).toBeInTheDocument();
  });

  it("popover remains functional after room creation", async () => {
    const mockPlayers = [{ id: "player-1", name: "Player 1", emoji: "😀" }];
    const onAddPlayer = vi.fn();

    renderWithProviders(
      <AddPlayerButton
        inactivePlayers={mockPlayers}
        shouldEmphasize={true}
        onAddPlayer={onAddPlayer}
      />,
    );

    // Open popover and create room
    const addButton = screen.getByTitle("Add player");
    fireEvent.click(addButton);

    const inviteTab = await screen.findByText("Invite Players 📨");
    fireEvent.click(inviteTab);

    // Wait for room creation
    await waitFor(() => {
      expect(screen.getByText("ABC123")).toBeInTheDocument();
    });

    // Now switch back to "Add Player" tab
    const addPlayerTab = screen.getByText("Add Player");
    fireEvent.click(addPlayerTab);

    // Verify we can see the player list
    await waitFor(() => {
      expect(screen.getByText("Player 1")).toBeInTheDocument();
    });

    // Click a player to add them
    const playerButton = screen.getByText("Player 1");
    fireEvent.click(playerButton);

    // Verify the callback was called
    expect(onAddPlayer).toHaveBeenCalledWith("player-1");
  });

  it("popover does not disappear after extended delay (1 second)", async () => {
    const mockPlayers = [
      { id: "player-1", name: "Player 1", emoji: "😀" },
      { id: "player-2", name: "Player 2", emoji: "😎" },
    ];

    renderWithProviders(
      <AddPlayerButton
        inactivePlayers={mockPlayers}
        shouldEmphasize={true}
        onAddPlayer={vi.fn()}
      />,
    );

    // Open popover
    const addButton = screen.getByTitle("Add player");
    fireEvent.click(addButton);

    // Click Invite tab
    const inviteTab = await screen.findByText("Invite Players 📨");
    fireEvent.click(inviteTab);

    // Wait for room creation
    await waitFor(() => {
      expect(screen.getByText("ABC123")).toBeInTheDocument();
    });

    // Wait 1 full second to catch any delayed disappearance
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    // Popover should STILL be visible
    expect(screen.queryByText("Invite Players 📨")).toBeInTheDocument();
    expect(screen.queryByText("ABC123")).toBeInTheDocument();
    expect(screen.queryByText("Share Link")).toBeInTheDocument();
  });
});
