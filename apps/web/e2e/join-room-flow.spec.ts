import { expect, test } from "@playwright/test";

test.describe("Join Room Flow", () => {
  test.describe("Room Creation", () => {
    test("should create a room from the game page", async ({ page }) => {
      // Navigate to a game
      await page.goto("/games/matching");
      await page.waitForLoadState("networkidle");

      // Click the (+) Add Player button to open the popover
      const addPlayerButton = page.locator('button[title="Add player"]');
      await expect(addPlayerButton).toBeVisible();
      await addPlayerButton.click();

      // Wait for popover to appear
      await page.waitForTimeout(300);

      // Click the "Play Online" or "Invite Players" tab
      const onlineTab = page.locator(
        'button:has-text("Play Online"), button:has-text("Invite")',
      );
      await expect(onlineTab.first()).toBeVisible();
      await onlineTab.first().click();

      // Click "Create New Room" button
      const createRoomButton = page.locator(
        'button:has-text("Create New Room")',
      );
      await expect(createRoomButton).toBeVisible();
      await createRoomButton.click();

      // Wait for room creation to complete
      await page.waitForTimeout(1000);

      // Verify we're now in a room - should see room info in nav
      const roomInfo = page.locator("text=/Room|Code/i");
      await expect(roomInfo).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Join Room by Code", () => {
    let roomCode: string;

    test.beforeEach(async ({ page }) => {
      // Create a room first
      await page.goto("/games/matching");
      await page.waitForLoadState("networkidle");

      const addPlayerButton = page.locator('button[title="Add player"]');
      await addPlayerButton.click();
      await page.waitForTimeout(300);

      const onlineTab = page.locator(
        'button:has-text("Play Online"), button:has-text("Invite")',
      );
      await onlineTab.first().click();

      const createRoomButton = page.locator(
        'button:has-text("Create New Room")',
      );
      await createRoomButton.click();
      await page.waitForTimeout(1000);

      // Extract the room code from the page
      const roomCodeElement = page.locator("text=/[A-Z]{3}-[0-9]{3}/");
      await expect(roomCodeElement).toBeVisible({ timeout: 5000 });
      const roomCodeText = await roomCodeElement.textContent();
      roomCode = roomCodeText?.match(/[A-Z]{3}-[0-9]{3}/)?.[0] || "";
      expect(roomCode).toMatch(/[A-Z]{3}-[0-9]{3}/);
    });

    test("should join room via direct URL", async ({ page, context }) => {
      // Open a new page (simulating a different user)
      const newPage = await context.newPage();

      // Navigate to the join URL
      await newPage.goto(`/join/${roomCode}`);
      await newPage.waitForLoadState("networkidle");

      // Should show "Joining room..." or redirect to game
      await newPage.waitForTimeout(1000);

      // Should now be in the room
      const url = newPage.url();
      expect(url).toContain("/arcade");
    });

    test("should show error for invalid room code", async ({
      page,
      context,
    }) => {
      const newPage = await context.newPage();

      // Try to join with invalid code
      await newPage.goto("/join/INVALID");
      await newPage.waitForLoadState("networkidle");

      // Should show error message
      const errorMessage = newPage.locator("text=/not found|failed/i");
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test("should show confirmation when switching rooms", async ({ page }) => {
      // User is already in a room from beforeEach

      // Try to join a different room (we'll create another one)
      const addPlayerButton = page.locator('button[title="Add player"]');
      await addPlayerButton.click();
      await page.waitForTimeout(300);

      const onlineTab = page.locator(
        'button:has-text("Play Online"), button:has-text("Invite")',
      );
      await onlineTab.first().click();

      const createRoomButton = page.locator(
        'button:has-text("Create New Room")',
      );
      await createRoomButton.click();
      await page.waitForTimeout(1000);

      // Get the new room code
      const newRoomCodeElement = page.locator("text=/[A-Z]{3}-[0-9]{3}/");
      await expect(newRoomCodeElement).toBeVisible({ timeout: 5000 });
      const newRoomCodeText = await newRoomCodeElement.textContent();
      const newRoomCode =
        newRoomCodeText?.match(/[A-Z]{3}-[0-9]{3}/)?.[0] || "";

      // Navigate to join the new room
      await page.goto(`/join/${newRoomCode}`);
      await page.waitForLoadState("networkidle");

      // Should show room switch confirmation
      const confirmationDialog = page.locator(
        "text=/Switch Rooms?|already in another room/i",
      );
      await expect(confirmationDialog).toBeVisible({ timeout: 3000 });

      // Should show both room codes
      await expect(page.locator(`text=${roomCode}`)).toBeVisible();
      await expect(page.locator(`text=${newRoomCode}`)).toBeVisible();

      // Click "Switch Rooms" button
      const switchButton = page.locator('button:has-text("Switch Rooms")');
      await expect(switchButton).toBeVisible();
      await switchButton.click();

      // Should navigate to the new room
      await page.waitForTimeout(1000);
      const url = page.url();
      expect(url).toContain("/arcade");
    });

    test("should stay in current room when canceling switch", async ({
      page,
    }) => {
      // User is already in a room from beforeEach
      const originalRoomCode = roomCode;

      // Create another room to try switching to
      const addPlayerButton = page.locator('button[title="Add player"]');
      await addPlayerButton.click();
      await page.waitForTimeout(300);

      const onlineTab = page.locator(
        'button:has-text("Play Online"), button:has-text("Invite")',
      );
      await onlineTab.first().click();

      const createRoomButton = page.locator(
        'button:has-text("Create New Room")',
      );
      await createRoomButton.click();
      await page.waitForTimeout(1000);

      const newRoomCodeElement = page.locator("text=/[A-Z]{3}-[0-9]{3}/");
      const newRoomCodeText = await newRoomCodeElement.textContent();
      const newRoomCode =
        newRoomCodeText?.match(/[A-Z]{3}-[0-9]{3}/)?.[0] || "";

      // Navigate to join the new room
      await page.goto(`/join/${newRoomCode}`);
      await page.waitForLoadState("networkidle");

      // Should show confirmation
      const confirmationDialog = page.locator("text=/Switch Rooms?/i");
      await expect(confirmationDialog).toBeVisible({ timeout: 3000 });

      // Click "Cancel"
      const cancelButton = page.locator('button:has-text("Cancel")');
      await expect(cancelButton).toBeVisible();
      await cancelButton.click();

      // Should stay on original room
      await page.waitForTimeout(500);
      const url = page.url();
      expect(url).toContain("/arcade");

      // Should still see original room code
      await expect(page.locator(`text=${originalRoomCode}`)).toBeVisible();
    });
  });

  test.describe("Join Room Input Validation", () => {
    test("should format room code as user types", async ({ page }) => {
      await page.goto("/games/matching");
      await page.waitForLoadState("networkidle");

      // Open the add player popover
      const addPlayerButton = page.locator('button[title="Add player"]');
      await addPlayerButton.click();
      await page.waitForTimeout(300);

      // Switch to Play Online tab
      const onlineTab = page.locator('button:has-text("Play Online")');
      if (await onlineTab.isVisible()) {
        await onlineTab.click();
      }

      // Find the room code input
      const codeInput = page.locator('input[placeholder*="ABC"]');
      await expect(codeInput).toBeVisible({ timeout: 3000 });

      // Type a room code
      await codeInput.fill("abc123");

      // Should be formatted as ABC-123
      const inputValue = await codeInput.inputValue();
      expect(inputValue).toBe("ABC-123");
    });

    test("should validate room code in real-time", async ({ page }) => {
      await page.goto("/games/matching");
      await page.waitForLoadState("networkidle");

      const addPlayerButton = page.locator('button[title="Add player"]');
      await addPlayerButton.click();
      await page.waitForTimeout(300);

      const onlineTab = page.locator('button:has-text("Play Online")');
      if (await onlineTab.isVisible()) {
        await onlineTab.click();
      }

      const codeInput = page.locator('input[placeholder*="ABC"]');
      await expect(codeInput).toBeVisible({ timeout: 3000 });

      // Type an invalid code
      await codeInput.fill("INVALID");

      // Should show validation icon (❌)
      await page.waitForTimeout(500);
      const validationIcon = page.locator("text=/❌|Room not found/i");
      await expect(validationIcon).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe("Recent Rooms List", () => {
    test("should show recently joined rooms", async ({ page }) => {
      // Create and join a room
      await page.goto("/games/matching");
      await page.waitForLoadState("networkidle");

      const addPlayerButton = page.locator('button[title="Add player"]');
      await addPlayerButton.click();
      await page.waitForTimeout(300);

      const onlineTab = page.locator(
        'button:has-text("Play Online"), button:has-text("Invite")',
      );
      await onlineTab.first().click();

      const createRoomButton = page.locator(
        'button:has-text("Create New Room")',
      );
      await createRoomButton.click();
      await page.waitForTimeout(1000);

      // Leave the room
      const leaveButton = page.locator(
        'button:has-text("Leave"), button:has-text("Quit")',
      );
      if (await leaveButton.isVisible()) {
        await leaveButton.click();
        await page.waitForTimeout(500);
      }

      // Open the popover again
      await addPlayerButton.click();
      await page.waitForTimeout(300);

      await onlineTab.first().click();

      // Should see "Recent Rooms" section
      const recentRoomsSection = page.locator("text=/Recent Rooms/i");
      await expect(recentRoomsSection).toBeVisible({ timeout: 3000 });

      // Should see at least one room in the list
      const roomListItem = page.locator("text=/[A-Z]{3}-[0-9]{3}/");
      await expect(roomListItem.first()).toBeVisible();
    });
  });

  test.describe("Room Ownership", () => {
    test("creator should see room controls", async ({ page }) => {
      // Create a room
      await page.goto("/games/matching");
      await page.waitForLoadState("networkidle");

      const addPlayerButton = page.locator('button[title="Add player"]');
      await addPlayerButton.click();
      await page.waitForTimeout(300);

      const onlineTab = page.locator(
        'button:has-text("Play Online"), button:has-text("Invite")',
      );
      await onlineTab.first().click();

      const createRoomButton = page.locator(
        'button:has-text("Create New Room")',
      );
      await createRoomButton.click();
      await page.waitForTimeout(1000);

      // Creator should see room management controls
      // (e.g., leave room, room settings, etc.)
      const roomControls = page.locator(
        'button:has-text("Leave"), button:has-text("Settings")',
      );
      await expect(roomControls.first()).toBeVisible({ timeout: 3000 });
    });
  });
});
