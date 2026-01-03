import { useState } from "react";
import { Modal } from "@/components/common/Modal";

export interface ReportPlayerModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;

  /**
   * Callback when modal should close
   */
  onClose: () => void;

  /**
   * The room ID
   */
  roomId: string;

  /**
   * The user being reported
   */
  reportedUser: {
    id: string;
    name: string;
  };

  /**
   * Optional callback when report is successfully submitted
   */
  onSuccess?: () => void;
}

const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "cheating", label: "Cheating or exploiting" },
  { value: "inappropriate-name", label: "Inappropriate name" },
  { value: "spam", label: "Spamming" },
  { value: "afk", label: "Away from keyboard (AFK)" },
  { value: "other", label: "Other" },
] as const;

/**
 * Modal for reporting a player to the host
 */
export function ReportPlayerModal({
  isOpen,
  onClose,
  roomId,
  reportedUser,
  onSuccess,
}: ReportPlayerModalProps) {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleClose = () => {
    setReason("");
    setDetails("");
    setError("");
    setIsLoading(false);
    setIsSuccess(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!reason) {
      setError("Please select a reason");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/arcade/rooms/${roomId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportedUserId: reportedUser.id,
          reason,
          details: details.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit report");
      }

      // Success!
      setIsSuccess(true);
      onSuccess?.();

      // Auto-close after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose}>
        <div
          style={{
            border: "2px solid rgba(34, 197, 94, 0.3)",
            borderRadius: "16px",
            textAlign: "center",
            padding: "40px 24px",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>✓</div>
          <h2
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              marginBottom: "8px",
              color: "rgba(134, 239, 172, 1)",
            }}
          >
            Report Submitted
          </h2>
          <p
            style={{
              fontSize: "14px",
              color: "rgba(209, 213, 219, 0.8)",
            }}
          >
            The host has been notified
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div
        style={{
          border: "2px solid rgba(239, 68, 68, 0.3)",
          borderRadius: "16px",
        }}
      >
        <h2
          style={{
            fontSize: "24px",
            fontWeight: "bold",
            marginBottom: "8px",
            color: "rgba(252, 165, 165, 1)",
          }}
        >
          Report Player
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "rgba(209, 213, 219, 0.8)",
            marginBottom: "24px",
          }}
        >
          Report <strong>{reportedUser.name}</strong> to the host
        </p>

        <form onSubmit={handleSubmit}>
          {/* Reason selector */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "rgba(209, 213, 219, 0.9)",
                marginBottom: "8px",
              }}
            >
              Reason *
            </label>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {REPORT_REASONS.map((option) => (
                <label
                  key={option.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 12px",
                    background:
                      reason === option.value
                        ? "rgba(239, 68, 68, 0.2)"
                        : "rgba(255, 255, 255, 0.05)",
                    border:
                      reason === option.value
                        ? "2px solid rgba(239, 68, 68, 0.5)"
                        : "2px solid rgba(75, 85, 99, 0.3)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (reason !== option.value) {
                      e.currentTarget.style.background =
                        "rgba(255, 255, 255, 0.08)";
                      e.currentTarget.style.borderColor =
                        "rgba(75, 85, 99, 0.5)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (reason !== option.value) {
                      e.currentTarget.style.background =
                        "rgba(255, 255, 255, 0.05)";
                      e.currentTarget.style.borderColor =
                        "rgba(75, 85, 99, 0.3)";
                    }
                  }}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={option.value}
                    checked={reason === option.value}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setError("");
                    }}
                    disabled={isLoading}
                    style={{
                      width: "18px",
                      height: "18px",
                      accentColor: "#ef4444",
                      cursor: "pointer",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "14px",
                      color: "rgba(209, 213, 219, 0.9)",
                      fontWeight: reason === option.value ? "600" : "500",
                    }}
                  >
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Optional details */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "rgba(209, 213, 219, 0.9)",
                marginBottom: "8px",
              }}
            >
              Additional details (optional)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide any additional context..."
              maxLength={500}
              rows={3}
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "12px",
                border: "2px solid rgba(75, 85, 99, 0.4)",
                borderRadius: "10px",
                fontSize: "14px",
                background: "rgba(255, 255, 255, 0.05)",
                color: "rgba(209, 213, 219, 1)",
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
            <div
              style={{
                fontSize: "12px",
                color: "rgba(156, 163, 175, 1)",
                textAlign: "right",
                marginTop: "4px",
              }}
            >
              {details.length}/500
            </div>
          </div>

          {error && (
            <p
              style={{
                fontSize: "13px",
                color: "rgba(248, 113, 113, 1)",
                marginBottom: "16px",
                textAlign: "center",
              }}
            >
              {error}
            </p>
          )}

          <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: "12px",
                background: "rgba(75, 85, 99, 0.3)",
                color: "rgba(209, 213, 219, 1)",
                border: "2px solid rgba(75, 85, 99, 0.5)",
                borderRadius: "10px",
                fontSize: "15px",
                fontWeight: 600,
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.5 : 1,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = "rgba(75, 85, 99, 0.4)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = "rgba(75, 85, 99, 0.3)";
                }
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reason || isLoading}
              style={{
                flex: 1,
                padding: "12px",
                background:
                  reason && !isLoading
                    ? "linear-gradient(135deg, rgba(239, 68, 68, 0.8), rgba(220, 38, 38, 0.8))"
                    : "rgba(75, 85, 99, 0.3)",
                color:
                  reason && !isLoading
                    ? "rgba(255, 255, 255, 1)"
                    : "rgba(156, 163, 175, 1)",
                border:
                  reason && !isLoading
                    ? "2px solid rgba(239, 68, 68, 0.6)"
                    : "2px solid rgba(75, 85, 99, 0.5)",
                borderRadius: "10px",
                fontSize: "15px",
                fontWeight: 600,
                cursor: reason && !isLoading ? "pointer" : "not-allowed",
                opacity: reason && !isLoading ? 1 : 0.5,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (reason && !isLoading) {
                  e.currentTarget.style.background =
                    "linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9))";
                }
              }}
              onMouseLeave={(e) => {
                if (reason && !isLoading) {
                  e.currentTarget.style.background =
                    "linear-gradient(135deg, rgba(239, 68, 68, 0.8), rgba(220, 38, 38, 0.8))";
                }
              }}
            >
              {isLoading ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
