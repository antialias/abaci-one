import { useRoomData } from '@/hooks/useRoomData'
import { useViewerId } from '@/hooks/useViewerId'
import { ActivePlayersList } from './ActivePlayersList'
import { AddPlayerButton } from './AddPlayerButton'
import { FullscreenPlayerSelection } from './FullscreenPlayerSelection'
import { GameModeIndicator } from './GameModeIndicator'
import { GameTitleMenu } from './GameTitleMenu'
import { NetworkPlayerIndicator } from './NetworkPlayerIndicator'
import { PendingInvitations } from './PendingInvitations'
import { RoomInfo } from './RoomInfo'
import type { PlayerBadge } from './types'

type GameMode = 'none' | 'single' | 'battle' | 'tournament'

interface Player {
  id: string
  name: string
  emoji: string
}

interface NetworkPlayer {
  id: string
  emoji?: string
  name?: string
  isOnline?: boolean
  userId?: string // The user ID controlling this player
}

interface ArcadeRoomInfo {
  roomId?: string
  roomName?: string
  gameName: string | null
  playerCount: number
  joinCode?: string
}

interface GameContextNavProps {
  navTitle: string
  navEmoji?: string
  gameName?: 'matching' | 'memory-quiz' | 'complement-race'
  gameMode: GameMode
  activePlayers: Player[]
  inactivePlayers: Player[]
  shouldEmphasize: boolean
  showFullscreenSelection: boolean
  onAddPlayer: (playerId: string) => void
  onRemovePlayer: (playerId: string) => void
  onConfigurePlayer: (playerId: string) => void
  onExitSession?: () => void
  onSetup?: () => void
  onNewGame?: () => void
  // Arcade session info
  networkPlayers?: NetworkPlayer[]
  roomInfo?: ArcadeRoomInfo
  // Game state for turn indicator
  currentPlayerId?: string
  playerScores?: Record<string, number>
  playerStreaks?: Record<string, number>
  playerBadges?: Record<string, PlayerBadge>
  // Lifted popover state from PageWithNav
  showPopover?: boolean
  setShowPopover?: (show: boolean) => void
  activeTab?: 'add' | 'invite'
  setActiveTab?: (tab: 'add' | 'invite') => void
}

export function GameContextNav({
  navTitle,
  navEmoji,
  gameName,
  gameMode,
  activePlayers,
  inactivePlayers,
  shouldEmphasize,
  showFullscreenSelection,
  onAddPlayer,
  onRemovePlayer,
  onConfigurePlayer,
  onExitSession,
  onSetup,
  onNewGame,
  networkPlayers = [],
  roomInfo,
  currentPlayerId,
  playerScores,
  playerStreaks,
  playerBadges,
  showPopover,
  setShowPopover,
  activeTab,
  setActiveTab,
}: GameContextNavProps) {
  // Get current user info for moderation
  const { data: currentUserId } = useViewerId()
  const { roomData, refetch: refetchRoomData } = useRoomData()

  // Check if current user is the host
  const currentMember = roomData?.members.find((m) => m.userId === currentUserId)
  const isCurrentUserHost = currentMember?.isCreator ?? false

  // 2x2 grid layout for normal mode, column for fullscreen
  if (showFullscreenSelection) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          width: '100%',
        }}
      >
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
            backgroundClip: 'text',
            color: 'transparent',
            margin: 0,
            transition: 'font-size 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {navEmoji && `${navEmoji} `}
          {navTitle}
        </h1>

        <GameModeIndicator
          gameMode={gameMode}
          shouldEmphasize={shouldEmphasize}
          showFullscreenSelection={showFullscreenSelection}
        />

        <FullscreenPlayerSelection
          inactivePlayers={inactivePlayers}
          onSelectPlayer={onAddPlayer}
          onConfigurePlayer={onConfigurePlayer}
          isVisible={showFullscreenSelection}
        />

        <style
          dangerouslySetInnerHTML={{
            __html: `
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes expandIn {
            from {
              opacity: 0;
              transform: scaleY(0.8);
            }
            to {
              opacity: 1;
              transform: scaleY(1);
            }
          }
        `,
          }}
        />
      </div>
    )
  }

  // Completely flat layout: ALL components always mounted, shown/hidden via display
  // This ensures AddPlayerButton never unmounts, preserving its state
  const showPlayers = activePlayers.length > 0 || (shouldEmphasize && inactivePlayers.length > 0)

  return (
    <>
      {/* Pending Invitations Banner - Shows above nav when user has invitations */}
      <PendingInvitations
        currentRoomId={roomInfo?.roomId}
        onInvitationChange={() => refetchRoomData()}
      />

      <div
        style={{
          display: 'flex',
          gap: '20px',
          alignItems: 'center',
          width: 'auto',
          whiteSpace: 'nowrap',
          overflow: 'visible',
        }}
      >
        {/* Game Title Section - Always mounted, hidden when in room */}
        <div
          style={{
            display: roomInfo ? 'none' : 'flex',
            alignItems: 'center',
            gap: '12px',
            flex: 1,
          }}
        >
          <GameTitleMenu
            navTitle={navTitle}
            navEmoji={navEmoji}
            onSetup={onSetup}
            onNewGame={onNewGame}
            onQuit={onExitSession}
            showMenu={true}
          />
          <div style={{ marginLeft: 'auto' }}>
            <GameModeIndicator
              gameMode={gameMode}
              shouldEmphasize={shouldEmphasize}
              showFullscreenSelection={false}
            />
          </div>
        </div>

        {/* Room Info Section - Always mounted, hidden when not in room */}
        <div
          style={{
            display: roomInfo ? 'flex' : 'none',
            alignItems: 'flex-end',
            gap: '12px',
            padding: '6px 12px 12px 12px',
            background:
              'linear-gradient(135deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.05))',
            borderRadius: '12px',
            border: '2px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.3s ease',
          }}
        >
          <RoomInfo
            roomId={roomInfo?.roomId}
            roomName={roomInfo?.roomName}
            gameName={roomInfo?.gameName ?? ''}
            playerCount={roomInfo?.playerCount ?? 0}
            joinCode={roomInfo?.joinCode}
            shouldEmphasize={shouldEmphasize}
            gameMode={gameMode}
            modeColor={
              gameMode === 'battle'
                ? '#8b5cf6'
                : gameMode === 'single'
                  ? '#3b82f6'
                  : gameMode === 'tournament'
                    ? '#f59e0b'
                    : '#6b7280'
            }
            modeEmoji={
              gameMode === 'battle'
                ? '⚔️'
                : gameMode === 'single'
                  ? '🎯'
                  : gameMode === 'tournament'
                    ? '🏆'
                    : '👥'
            }
            modeLabel={
              gameMode === 'battle'
                ? 'Battle'
                : gameMode === 'single'
                  ? 'Solo'
                  : gameMode === 'tournament'
                    ? 'Tournament'
                    : 'Select Players'
            }
            navTitle={navTitle}
            navEmoji={navEmoji}
            onSetup={onSetup}
            onNewGame={onNewGame}
            onQuit={onExitSession}
          />

          {/* Network Players - inside same pane as room info */}
          {networkPlayers.length > 0 && (
            <>
              <div
                style={{
                  width: '1px',
                  height: '48px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  margin: '0 4px',
                }}
              />
              {networkPlayers.map((player) => (
                <NetworkPlayerIndicator
                  key={player.id}
                  player={player}
                  shouldEmphasize={shouldEmphasize}
                  currentPlayerId={currentPlayerId}
                  playerScores={playerScores}
                  playerStreaks={playerStreaks}
                  playerBadges={playerBadges}
                  roomId={roomInfo?.roomId}
                  currentUserId={currentUserId ?? undefined}
                  isCurrentUserHost={isCurrentUserHost}
                />
              ))}
            </>
          )}
        </div>

        {/* Player Section - Always mounted, hidden when no players */}
        <div
          style={{
            display: showPlayers ? 'flex' : 'none',
            alignItems: 'flex-end',
            gap: shouldEmphasize ? '12px' : '8px',
            padding: shouldEmphasize ? '12px 20px 16px 20px' : '6px 12px 12px 12px',
            background: shouldEmphasize
              ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.10))'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.05))',
            borderRadius: shouldEmphasize ? '16px' : '12px',
            border: shouldEmphasize
              ? '3px solid rgba(255, 255, 255, 0.3)'
              : '2px solid rgba(255, 255, 255, 0.15)',
            boxShadow: shouldEmphasize
              ? '0 8px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.3)'
              : '0 4px 12px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: shouldEmphasize ? 'scale(1.05)' : 'scale(1)',
          }}
        >
          <ActivePlayersList
            activePlayers={activePlayers}
            shouldEmphasize={shouldEmphasize}
            onRemovePlayer={onRemovePlayer}
            onConfigurePlayer={onConfigurePlayer}
            currentPlayerId={currentPlayerId}
            playerScores={playerScores}
            playerStreaks={playerStreaks}
            playerBadges={playerBadges}
          />

          <AddPlayerButton
            inactivePlayers={inactivePlayers}
            shouldEmphasize={shouldEmphasize}
            onAddPlayer={onAddPlayer}
            showPopover={showPopover}
            setShowPopover={setShowPopover}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isInRoom={!!roomInfo}
            gameName={gameName || 'matching'}
          />
        </div>

        <style
          dangerouslySetInnerHTML={{
            __html: `
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes expandIn {
          from {
            opacity: 0;
            transform: scaleY(0.8);
          }
          to {
            opacity: 1;
            transform: scaleY(1);
          }
        }
      `,
          }}
        />
      </div>
    </>
  )
}
