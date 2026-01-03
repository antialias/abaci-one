import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/common/ToastContext";
import { useJoinRoom } from "@/hooks/useRoomData";

interface PendingInvitation {
  id: string;
  roomId: string;
  roomName: string;
  roomGameName: string;
  invitedBy: string;
  invitedByName: string;
  invitationType: "manual" | "auto-unban" | "auto-create";
  message?: string | null;
  createdAt: Date;
  expiresAt?: Date | null;
}

export interface PendingInvitationsProps {
  /**
   * Called when invitations change (for refreshing)
   */
  onInvitationChange?: () => void;
  /**
   * Optional: Room ID to exclude (if user is already in this room)
   */
  currentRoomId?: string;
}

/**
 * Displays a list of pending room invitations for the current user
 * Excludes invitations for the room the user is currently in
 */
export function PendingInvitations({
  onInvitationChange,
  currentRoomId,
}: PendingInvitationsProps) {
  const router = useRouter();
  const { showError } = useToast();
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { mutateAsync: joinRoom } = useJoinRoom();

  const fetchInvitations = async () => {
    try {
      const res = await fetch("/api/arcade/invitations/pending");
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch invitations");
      }
    } catch (err) {
      console.error("Failed to fetch invitations:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load invitations",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  const handleAccept = async (invitation: PendingInvitation) => {
    setActionLoading(`accept-${invitation.id}`);
    try {
      // Join the room
      await joinRoom({ roomId: invitation.roomId });
      // Navigate to the room
      router.push("/arcade");
      // Refresh invitations
      await fetchInvitations();
      onInvitationChange?.();
    } catch (error) {
      console.error("Failed to join room:", error);
      showError(
        "Failed to join room",
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (invitation: PendingInvitation) => {
    setActionLoading(`decline-${invitation.id}`);
    try {
      // Decline the invitation
      const res = await fetch(`/api/arcade/rooms/${invitation.roomId}/invite`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to decline invitation");
      }

      // Refresh invitations
      await fetchInvitations();
      onInvitationChange?.();
    } catch (error) {
      console.error("Failed to decline invitation:", error);
      showError(
        "Failed to decline invitation",
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          padding: "16px",
          textAlign: "center",
          color: "rgba(156, 163, 175, 1)",
          fontSize: "14px",
        }}
      >
        Loading invitations...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "16px",
          textAlign: "center",
          color: "rgba(239, 68, 68, 1)",
          fontSize: "14px",
        }}
      >
        {error}
      </div>
    );
  }

  // Filter out invitations for the current room
  const filteredInvitations = currentRoomId
    ? invitations.filter((inv) => inv.roomId !== currentRoomId)
    : invitations;

  if (filteredInvitations.length === 0) {
    return null; // Don't show anything if no invitations
  }

  return (
    <div
      style={{
        background:
          "linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.1))",
        border: "2px solid rgba(139, 92, 246, 0.4)",
        borderRadius: "16px",
        padding: "20px",
        marginBottom: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <span style={{ fontSize: "24px" }}>✉️</span>
        <h3
          style={{
            fontSize: "18px",
            fontWeight: "bold",
            color: "rgba(196, 181, 253, 1)",
            margin: 0,
          }}
        >
          Room Invitations ({filteredInvitations.length})
        </h3>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filteredInvitations.map((invitation) => {
          const isAutoUnban = invitation.invitationType === "auto-unban";
          const timeSince = Math.floor(
            (Date.now() - new Date(invitation.createdAt).getTime()) / 1000 / 60,
          );
          const timeText =
            timeSince < 1
              ? "Just now"
              : timeSince < 60
                ? `${timeSince}m ago`
                : `${Math.floor(timeSince / 60)}h ago`;

          return (
            <div
              key={invitation.id}
              style={{
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "4px",
                  }}
                >
                  {isAutoUnban && <span style={{ fontSize: "20px" }}>🎉</span>}
                  <h4
                    style={{
                      fontSize: "16px",
                      fontWeight: "bold",
                      color: "white",
                      margin: 0,
                    }}
                  >
                    {invitation.roomName}
                  </h4>
                </div>
                <p
                  style={{
                    fontSize: "13px",
                    color: "rgba(209, 213, 219, 0.9)",
                    margin: "4px 0",
                  }}
                >
                  <strong>{invitation.invitedByName}</strong> invited you •{" "}
                  {timeText}
                </p>
                {invitation.message && (
                  <p
                    style={{
                      fontSize: "12px",
                      color: "rgba(156, 163, 175, 1)",
                      margin: "4px 0",
                      fontStyle: "italic",
                    }}
                  >
                    "{invitation.message}"
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => handleDecline(invitation)}
                  disabled={actionLoading === `decline-${invitation.id}`}
                  style={{
                    padding: "8px 16px",
                    background: "rgba(75, 85, 99, 0.3)",
                    color: "rgba(209, 213, 219, 1)",
                    border: "1px solid rgba(75, 85, 99, 0.5)",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor:
                      actionLoading === `decline-${invitation.id}`
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      actionLoading === `decline-${invitation.id}` ? 0.5 : 1,
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (actionLoading !== `decline-${invitation.id}`) {
                      e.currentTarget.style.background =
                        "rgba(75, 85, 99, 0.4)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (actionLoading !== `decline-${invitation.id}`) {
                      e.currentTarget.style.background =
                        "rgba(75, 85, 99, 0.3)";
                    }
                  }}
                >
                  {actionLoading === `decline-${invitation.id}`
                    ? "Declining..."
                    : "Decline"}
                </button>
                <button
                  type="button"
                  onClick={() => handleAccept(invitation)}
                  disabled={
                    actionLoading === `accept-${invitation.id}` ||
                    actionLoading === `decline-${invitation.id}`
                  }
                  style={{
                    padding: "8px 16px",
                    background:
                      "linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.8))",
                    color: "white",
                    border: "1px solid rgba(59, 130, 246, 0.6)",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor:
                      actionLoading === `accept-${invitation.id}` ||
                      actionLoading === `decline-${invitation.id}`
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      actionLoading === `accept-${invitation.id}` ||
                      actionLoading === `decline-${invitation.id}`
                        ? 0.5
                        : 1,
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (
                      actionLoading !== `accept-${invitation.id}` &&
                      actionLoading !== `decline-${invitation.id}`
                    ) {
                      e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (
                      actionLoading !== `accept-${invitation.id}` &&
                      actionLoading !== `decline-${invitation.id}`
                    ) {
                      e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.8))";
                    }
                  }}
                >
                  {actionLoading === `accept-${invitation.id}`
                    ? "Joining..."
                    : "Accept & Join"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
