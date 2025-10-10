"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSocketIO = getSocketIO;
exports.initializeSocketServer = initializeSocketServer;
const socket_io_1 = require("socket.io");
const session_manager_1 = require("./src/lib/arcade/session-manager");
const room_manager_1 = require("./src/lib/arcade/room-manager");
const room_membership_1 = require("./src/lib/arcade/room-membership");
const player_manager_1 = require("./src/lib/arcade/player-manager");
const MatchingGameValidator_1 = require("./src/lib/arcade/validation/MatchingGameValidator");
/**
 * Get the socket.io server instance
 * Returns null if not initialized
 */
function getSocketIO() {
  return globalThis.__socketIO || null;
}
function initializeSocketServer(httpServer) {
  const io = new socket_io_1.Server(httpServer, {
    path: "/api/socket",
    cors: {
      origin: process.env.NEXT_PUBLIC_URL || "http://localhost:3000",
      credentials: true,
    },
  });
  io.on("connection", (socket) => {
    console.log("🔌 Client connected:", socket.id);
    let currentUserId = null;
    // Join arcade session room
    socket.on("join-arcade-session", async ({ userId, roomId }) => {
      currentUserId = userId;
      socket.join(`arcade:${userId}`);
      console.log(`👤 User ${userId} joined arcade room`);
      // If this session is part of a room, also join the game room for multi-user sync
      if (roomId) {
        socket.join(`game:${roomId}`);
        console.log(`🎮 User ${userId} joined game room ${roomId}`);
      }
      // Send current session state if exists
      // For room-based games, look up shared room session
      try {
        const session = roomId
          ? await (0, session_manager_1.getArcadeSessionByRoom)(roomId)
          : await (0, session_manager_1.getArcadeSession)(userId);
        if (session) {
          console.log("[join-arcade-session] Found session:", {
            userId,
            roomId,
            version: session.version,
            sessionUserId: session.userId,
          });
          socket.emit("session-state", {
            gameState: session.gameState,
            currentGame: session.currentGame,
            gameUrl: session.gameUrl,
            activePlayers: session.activePlayers,
            version: session.version,
          });
        } else {
          console.log("[join-arcade-session] No active session found for:", {
            userId,
            roomId,
          });
          socket.emit("no-active-session");
        }
      } catch (error) {
        console.error("Error fetching session:", error);
        socket.emit("session-error", { error: "Failed to fetch session" });
      }
    });
    // Handle game moves
    socket.on("game-move", async (data) => {
      console.log("🎮 Game move received:", {
        userId: data.userId,
        moveType: data.move.type,
        playerId: data.move.playerId,
        timestamp: data.move.timestamp,
        roomId: data.roomId,
        fullMove: JSON.stringify(data.move, null, 2),
      });
      try {
        // Special handling for START_GAME - create session if it doesn't exist
        if (data.move.type === "START_GAME") {
          // For room-based games, check if room session exists
          const existingSession = data.roomId
            ? await (0, session_manager_1.getArcadeSessionByRoom)(data.roomId)
            : await (0, session_manager_1.getArcadeSession)(data.userId);
          if (!existingSession) {
            console.log("🎯 Creating new session for START_GAME");
            // activePlayers must be provided in the START_GAME move data
            const activePlayers = data.move.data?.activePlayers;
            if (!activePlayers || activePlayers.length === 0) {
              console.error("❌ START_GAME move missing activePlayers");
              socket.emit("move-rejected", {
                error: "START_GAME requires at least one active player",
                move: data.move,
              });
              return;
            }
            // Get initial state from validator
            const initialState =
              MatchingGameValidator_1.matchingGameValidator.getInitialState({
                difficulty: 6,
                gameType: "abacus-numeral",
                turnTimer: 30,
              });
            // Check if user is already in a room for this game
            const userRoomIds = await (0, room_membership_1.getUserRooms)(
              data.userId,
            );
            let room = null;
            // Look for an existing active room for this game
            for (const roomId of userRoomIds) {
              const existingRoom = await (0, room_manager_1.getRoomById)(
                roomId,
              );
              if (
                existingRoom &&
                existingRoom.gameName === "matching" &&
                existingRoom.status !== "finished"
              ) {
                room = existingRoom;
                console.log("🏠 Using existing room:", room.code);
                break;
              }
            }
            // If no suitable room exists, create a new one
            if (!room) {
              room = await (0, room_manager_1.createRoom)({
                name: "Auto-generated Room",
                createdBy: data.userId,
                creatorName: "Player",
                gameName: "matching",
                gameConfig: {
                  difficulty: 6,
                  gameType: "abacus-numeral",
                  turnTimer: 30,
                },
                ttlMinutes: 60,
              });
              console.log("🏠 Created new room:", room.code);
            }
            // Now create the session linked to the room
            await (0, session_manager_1.createArcadeSession)({
              userId: data.userId,
              gameName: "matching",
              gameUrl: "/arcade/room", // Room-based sessions use /arcade/room
              initialState,
              activePlayers,
              roomId: room.id,
            });
            console.log(
              "✅ Session created successfully with room association",
            );
            // Notify all connected clients about the new session
            const newSession = await (0, session_manager_1.getArcadeSession)(
              data.userId,
            );
            if (newSession) {
              io.to(`arcade:${data.userId}`).emit("session-state", {
                gameState: newSession.gameState,
                currentGame: newSession.currentGame,
                gameUrl: newSession.gameUrl,
                activePlayers: newSession.activePlayers,
                version: newSession.version,
              });
              console.log(
                "📢 Emitted session-state to notify clients of new session",
              );
            }
          }
        }
        // Apply game move - use roomId for room-based games to access shared session
        const result = await (0, session_manager_1.applyGameMove)(
          data.userId,
          data.move,
          data.roomId,
        );
        if (result.success && result.session) {
          const moveAcceptedData = {
            gameState: result.session.gameState,
            version: result.session.version,
            move: data.move,
          };
          // Broadcast the updated state to all devices for this user
          io.to(`arcade:${data.userId}`).emit(
            "move-accepted",
            moveAcceptedData,
          );
          // If this is a room-based session, ALSO broadcast to all users in the room
          if (result.session.roomId) {
            io.to(`game:${result.session.roomId}`).emit(
              "move-accepted",
              moveAcceptedData,
            );
            console.log(
              `📢 Broadcasted move to game room ${result.session.roomId}`,
            );
          }
          // Update activity timestamp
          await (0, session_manager_1.updateSessionActivity)(data.userId);
        } else {
          // Send rejection only to the requesting socket
          socket.emit("move-rejected", {
            error: result.error,
            move: data.move,
            versionConflict: result.versionConflict,
          });
        }
      } catch (error) {
        console.error("Error processing move:", error);
        socket.emit("move-rejected", {
          error: "Server error processing move",
          move: data.move,
        });
      }
    });
    // Handle session exit
    socket.on("exit-arcade-session", async ({ userId }) => {
      console.log("🚪 User exiting arcade session:", userId);
      try {
        await (0, session_manager_1.deleteArcadeSession)(userId);
        io.to(`arcade:${userId}`).emit("session-ended");
      } catch (error) {
        console.error("Error ending session:", error);
        socket.emit("session-error", { error: "Failed to end session" });
      }
    });
    // Keep-alive ping
    socket.on("ping-session", async ({ userId }) => {
      try {
        await (0, session_manager_1.updateSessionActivity)(userId);
        socket.emit("pong-session");
      } catch (error) {
        console.error("Error updating activity:", error);
      }
    });
    // Room: Join
    socket.on("join-room", async ({ roomId, userId }) => {
      console.log(`🏠 User ${userId} joining room ${roomId}`);
      try {
        // Join the socket room
        socket.join(`room:${roomId}`);
        // Mark member as online
        await (0, room_membership_1.setMemberOnline)(roomId, userId, true);
        // Get room data
        const members = await (0, room_membership_1.getRoomMembers)(roomId);
        const memberPlayers = await (0, player_manager_1.getRoomActivePlayers)(
          roomId,
        );
        // Convert memberPlayers Map to object for JSON serialization
        const memberPlayersObj = {};
        for (const [uid, players] of memberPlayers.entries()) {
          memberPlayersObj[uid] = players;
        }
        // Send current room state to the joining user
        socket.emit("room-joined", {
          roomId,
          members,
          memberPlayers: memberPlayersObj,
        });
        // Notify all other members in the room
        socket.to(`room:${roomId}`).emit("member-joined", {
          roomId,
          userId,
          members,
          memberPlayers: memberPlayersObj,
        });
        console.log(`✅ User ${userId} joined room ${roomId}`);
      } catch (error) {
        console.error("Error joining room:", error);
        socket.emit("room-error", { error: "Failed to join room" });
      }
    });
    // Room: Leave
    socket.on("leave-room", async ({ roomId, userId }) => {
      console.log(`🚪 User ${userId} leaving room ${roomId}`);
      try {
        // Leave the socket room
        socket.leave(`room:${roomId}`);
        // Mark member as offline
        await (0, room_membership_1.setMemberOnline)(roomId, userId, false);
        // Get updated members
        const members = await (0, room_membership_1.getRoomMembers)(roomId);
        const memberPlayers = await (0, player_manager_1.getRoomActivePlayers)(
          roomId,
        );
        // Convert memberPlayers Map to object
        const memberPlayersObj = {};
        for (const [uid, players] of memberPlayers.entries()) {
          memberPlayersObj[uid] = players;
        }
        // Notify remaining members
        io.to(`room:${roomId}`).emit("member-left", {
          roomId,
          userId,
          members,
          memberPlayers: memberPlayersObj,
        });
        console.log(`✅ User ${userId} left room ${roomId}`);
      } catch (error) {
        console.error("Error leaving room:", error);
      }
    });
    // Room: Players updated
    socket.on("players-updated", async ({ roomId, userId }) => {
      console.log(`🎯 Players updated for user ${userId} in room ${roomId}`);
      try {
        // Get updated player data
        const memberPlayers = await (0, player_manager_1.getRoomActivePlayers)(
          roomId,
        );
        // Convert memberPlayers Map to object
        const memberPlayersObj = {};
        for (const [uid, players] of memberPlayers.entries()) {
          memberPlayersObj[uid] = players;
        }
        // Broadcast to all members in the room (including sender)
        io.to(`room:${roomId}`).emit("room-players-updated", {
          roomId,
          memberPlayers: memberPlayersObj,
        });
        console.log(`✅ Broadcasted player updates for room ${roomId}`);
      } catch (error) {
        console.error("Error updating room players:", error);
        socket.emit("room-error", { error: "Failed to update players" });
      }
    });
    socket.on("disconnect", () => {
      console.log("🔌 Client disconnected:", socket.id);
      if (currentUserId) {
        // Don't delete session on disconnect - it persists across devices
        console.log(
          `👤 User ${currentUserId} disconnected but session persists`,
        );
      }
    });
  });
  // Store in globalThis to make accessible across module boundaries
  globalThis.__socketIO = io;
  console.log("✅ Socket.IO initialized on /api/socket");
  return io;
}
