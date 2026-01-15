"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useEffect, useState } from "react";
import { AbacusQRCode } from "@/components/common/AbacusQRCode";
import { EmojiPicker } from "@/components/EmojiPicker";
import { Z_INDEX } from "@/constants/zIndex";
import { PLAYER_EMOJIS } from "@/constants/playerEmojis";
import { useTheme } from "@/contexts/ThemeContext";
import { useDirectEnrollStudent } from "@/hooks/useClassroom";
import { useShareCode } from "@/hooks/useShareCode";
import { useCreatePlayer } from "@/hooks/useUserPlayers";
import { css } from "../../../styled-system/css";

// Available colors for student avatars
const AVAILABLE_COLORS = [
  "#FFB3BA", // light pink
  "#FFDFBA", // light orange
  "#FFFFBA", // light yellow
  "#BAFFC9", // light green
  "#BAE1FF", // light blue
  "#DCC6E0", // light purple
  "#F0E68C", // khaki
  "#98D8C8", // mint
  "#F7DC6F", // gold
  "#BB8FCE", // orchid
  "#85C1E9", // sky blue
  "#F8B500", // amber
];

interface PlayerPreview {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

type LeftColumnMode = "choose" | "create" | "family-success";

export interface AddStudentToClassroomContentProps {
  classroomId: string;
  classroomCode: string;
  /** Optional callback when a student is successfully added (for modal close) */
  onStudentAdded?: () => void;
}

/**
 * Content for adding students to a classroom - used both in modal and inline.
 *
 * Two columns:
 * - Left: "ADD NOW" - Create student form OR enter family code
 * - Right: "INVITE PARENTS" - Share classroom code with QR
 */
export function AddStudentToClassroomContent({
  classroomId,
  classroomCode,
  onStudentAdded,
}: AddStudentToClassroomContentProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Left column mode: choose (initial), create (form), or family-success
  const [leftMode, setLeftMode] = useState<LeftColumnMode>("choose");

  // Create student form state
  const [formName, setFormName] = useState("");
  const [formEmoji, setFormEmoji] = useState(PLAYER_EMOJIS[0]);
  const [formColor, setFormColor] = useState(AVAILABLE_COLORS[0]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Family code input state
  const [familyCode, setFamilyCode] = useState("");
  const [isSubmittingFamilyCode, setIsSubmittingFamilyCode] = useState(false);
  const [familyCodeError, setFamilyCodeError] = useState<string | null>(null);
  const [enrolledPlayer, setEnrolledPlayer] = useState<PlayerPreview | null>(
    null,
  );

  // Mutations
  const createPlayer = useCreatePlayer();
  const directEnroll = useDirectEnrollStudent();

  // Share code hook for the classroom
  const shareCode = useShareCode({ type: "classroom", code: classroomCode });

  // Initialize with random emoji/color
  useEffect(() => {
    setFormEmoji(
      PLAYER_EMOJIS[Math.floor(Math.random() * PLAYER_EMOJIS.length)],
    );
    setFormColor(
      AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)],
    );
  }, []);

  const handleFamilyCodeSubmit = useCallback(async () => {
    if (!familyCode.trim()) {
      setFamilyCodeError("Please enter a family code");
      return;
    }

    setIsSubmittingFamilyCode(true);
    setFamilyCodeError(null);

    try {
      const response = await fetch(
        `/api/classrooms/${classroomId}/enroll-by-family-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ familyCode: familyCode.trim() }),
        },
      );

      const data = await response.json();

      if (!data.success) {
        setFamilyCodeError(data.error || "Failed to add student");
        return;
      }

      setEnrolledPlayer(data.player);
      setLeftMode("family-success");
    } catch (_err) {
      setFamilyCodeError("Failed to add student. Please try again.");
    } finally {
      setIsSubmittingFamilyCode(false);
    }
  }, [familyCode, classroomId]);

  const handleCreateStudentSubmit = useCallback(() => {
    if (!formName.trim()) return;

    createPlayer.mutate(
      {
        name: formName.trim(),
        emoji: formEmoji,
        color: formColor,
      },
      {
        onSuccess: (player) => {
          if (player) {
            directEnroll.mutate(
              { classroomId, playerId: player.id },
              {
                onSettled: () => {
                  onStudentAdded?.();
                },
              },
            );
          } else {
            onStudentAdded?.();
          }
        },
      },
    );
  }, [
    formName,
    formEmoji,
    formColor,
    createPlayer,
    classroomId,
    directEnroll,
    onStudentAdded,
  ]);

  const handleBackToChoose = useCallback(() => {
    setLeftMode("choose");
    setFamilyCode("");
    setFamilyCodeError(null);
    setEnrolledPlayer(null);
  }, []);

  const handleStartCreate = useCallback(() => {
    // Randomize emoji and color when entering create mode
    setFormEmoji(
      PLAYER_EMOJIS[Math.floor(Math.random() * PLAYER_EMOJIS.length)],
    );
    setFormColor(
      AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)],
    );
    setFormName("");
    setLeftMode("create");
  }, []);

  const isPending = createPlayer.isPending || directEnroll.isPending;

  // Show emoji picker as overlay
  if (showEmojiPicker) {
    return (
      <EmojiPicker
        currentEmoji={formEmoji}
        onEmojiSelect={(emoji) => {
          setFormEmoji(emoji);
          setShowEmojiPicker(false);
        }}
        onClose={() => setShowEmojiPicker(false)}
        title="Choose Avatar"
        accentColor="green"
        isDark={isDark}
      />
    );
  }

  return (
    <div
      data-component="add-student-to-classroom-content"
      className={css({
        display: "grid",
        gridTemplateColumns: { base: "1fr", md: "1fr 1fr" },
        gap: "0",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid",
        borderColor: isDark ? "gray.700" : "gray.200",
      })}
    >
      {/* Left column: ADD NOW */}
      <div
        data-section="add-now"
        className={css({
          padding: "20px",
          borderRight: { base: "none", md: "1px solid" },
          borderBottom: { base: "1px solid", md: "none" },
          borderColor: isDark ? "gray.700" : "gray.200",
          backgroundColor: isDark ? "gray.800" : "white",
        })}
      >
        <h3
          className={css({
            fontSize: "0.75rem",
            fontWeight: "bold",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: isDark ? "gray.400" : "gray.500",
            marginBottom: "16px",
          })}
        >
          Add Now
        </h3>

        {leftMode === "choose" && (
          <ChooseSection
            onCreateStudent={handleStartCreate}
            familyCode={familyCode}
            onFamilyCodeChange={(val) => {
              setFamilyCode(val);
              setFamilyCodeError(null);
            }}
            onFamilyCodeSubmit={handleFamilyCodeSubmit}
            isSubmittingFamilyCode={isSubmittingFamilyCode}
            familyCodeError={familyCodeError}
            isDark={isDark}
          />
        )}

        {leftMode === "create" && (
          <CreateStudentSection
            name={formName}
            onNameChange={setFormName}
            emoji={formEmoji}
            onEmojiClick={() => setShowEmojiPicker(true)}
            color={formColor}
            onColorChange={setFormColor}
            onSubmit={handleCreateStudentSubmit}
            onCancel={handleBackToChoose}
            isPending={isPending}
            isDark={isDark}
          />
        )}

        {leftMode === "family-success" && enrolledPlayer && (
          <FamilyCodeSuccess
            player={enrolledPlayer}
            isDark={isDark}
            onAddAnother={handleBackToChoose}
            onDone={onStudentAdded}
          />
        )}
      </div>

      {/* Right column: INVITE PARENTS */}
      <div
        data-section="invite-parents"
        className={css({
          padding: "20px",
          backgroundColor: isDark ? "gray.750" : "gray.50",
        })}
      >
        <h3
          className={css({
            fontSize: "0.75rem",
            fontWeight: "bold",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: isDark ? "gray.400" : "gray.500",
            marginBottom: "16px",
          })}
        >
          Invite Parents
        </h3>

        <p
          className={css({
            fontSize: "0.875rem",
            color: isDark ? "gray.300" : "gray.600",
            marginBottom: "16px",
            lineHeight: "1.5",
          })}
        >
          Share this code with parents. They'll enter it to request enrollment,
          and you'll approve each request.
        </p>

        {/* QR Code */}
        <div
          data-element="qr-code-container"
          className={css({
            display: "flex",
            justifyContent: "center",
            padding: "16px",
            backgroundColor: "white",
            borderRadius: "12px",
            border: "1px solid",
            borderColor: isDark ? "gray.600" : "gray.200",
            marginBottom: "16px",
          })}
        >
          <AbacusQRCode value={shareCode.shareUrl} size={160} />
        </div>

        {/* Code display + copy buttons */}
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          })}
        >
          {/* Code button */}
          <button
            type="button"
            onClick={shareCode.copyCode}
            data-action="copy-code"
            data-status={shareCode.codeCopied ? "copied" : "idle"}
            className={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "12px 16px",
              backgroundColor: shareCode.codeCopied
                ? isDark
                  ? "green.900/60"
                  : "green.50"
                : isDark
                  ? "purple.900/60"
                  : "purple.50",
              border: "2px solid",
              borderColor: shareCode.codeCopied
                ? isDark
                  ? "green.700"
                  : "green.300"
                : isDark
                  ? "purple.700"
                  : "purple.300",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              _hover: {
                backgroundColor: shareCode.codeCopied
                  ? isDark
                    ? "green.800/60"
                    : "green.100"
                  : isDark
                    ? "purple.800/60"
                    : "purple.100",
              },
            })}
          >
            <span
              className={css({
                fontSize: "1.125rem",
                fontFamily: "monospace",
                fontWeight: "bold",
                letterSpacing: "0.1em",
                color: shareCode.codeCopied
                  ? isDark
                    ? "green.300"
                    : "green.700"
                  : isDark
                    ? "purple.300"
                    : "purple.700",
              })}
            >
              {shareCode.codeCopied ? "✓ Copied!" : classroomCode}
            </span>
            {!shareCode.codeCopied && (
              <span
                className={css({
                  fontSize: "0.75rem",
                  color: isDark ? "purple.400" : "purple.500",
                })}
              >
                Copy
              </span>
            )}
          </button>

          {/* Link button */}
          <button
            type="button"
            onClick={shareCode.copyLink}
            data-action="copy-link"
            data-status={shareCode.linkCopied ? "copied" : "idle"}
            className={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "10px 16px",
              backgroundColor: shareCode.linkCopied
                ? isDark
                  ? "green.900/60"
                  : "green.50"
                : isDark
                  ? "blue.900/60"
                  : "blue.50",
              border: "1px solid",
              borderColor: shareCode.linkCopied
                ? isDark
                  ? "green.700"
                  : "green.300"
                : isDark
                  ? "blue.700"
                  : "blue.300",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              _hover: {
                backgroundColor: shareCode.linkCopied
                  ? isDark
                    ? "green.800/60"
                    : "green.100"
                  : isDark
                    ? "blue.800/60"
                    : "blue.100",
              },
            })}
          >
            <span
              className={css({
                fontSize: "0.875rem",
                color: shareCode.linkCopied
                  ? isDark
                    ? "green.300"
                    : "green.700"
                  : isDark
                    ? "blue.300"
                    : "blue.700",
              })}
            >
              {shareCode.linkCopied
                ? "✓ Link copied!"
                : "🔗 Copy link to share"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface AddStudentToClassroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroomId: string;
  classroomName: string;
  classroomCode: string;
}

/**
 * Modal wrapper for AddStudentToClassroomContent.
 */
export function AddStudentToClassroomModal({
  isOpen,
  onClose,
  classroomId,
  classroomName,
  classroomCode,
}: AddStudentToClassroomModalProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={css({
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            zIndex: Z_INDEX.MODAL,
          })}
        />
        <Dialog.Content
          data-component="add-student-to-classroom-modal"
          className={css({
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: isDark ? "gray.800" : "white",
            borderRadius: "16px",
            width: "calc(100% - 2rem)",
            maxWidth: "700px",
            maxHeight: "90vh",
            overflowY: "auto",
            boxShadow: "0 20px 50px -12px rgba(0, 0, 0, 0.4)",
            zIndex: Z_INDEX.MODAL + 1,
            outline: "none",
          })}
        >
          {/* Header */}
          <div
            data-element="modal-header"
            className={css({
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 20px",
              borderBottom: "1px solid",
              borderColor: isDark ? "gray.700" : "gray.200",
            })}
          >
            <Dialog.Title
              className={css({
                fontSize: "1.25rem",
                fontWeight: "bold",
                color: isDark ? "white" : "gray.900",
              })}
            >
              Add Student to {classroomName}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                data-action="close-modal"
                className={css({
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.25rem",
                  color: isDark ? "gray.400" : "gray.500",
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  _hover: {
                    backgroundColor: isDark ? "gray.700" : "gray.100",
                  },
                })}
                aria-label="Close"
              >
                ×
              </button>
            </Dialog.Close>
          </div>

          {/* Content - no border since modal provides it */}
          <div className={css({ padding: "20px" })}>
            <AddStudentToClassroomContent
              classroomId={classroomId}
              classroomCode={classroomCode}
              onStudentAdded={onClose}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// --- Sub-components ---

interface ChooseSectionProps {
  onCreateStudent: () => void;
  familyCode: string;
  onFamilyCodeChange: (value: string) => void;
  onFamilyCodeSubmit: () => void;
  isSubmittingFamilyCode: boolean;
  familyCodeError: string | null;
  isDark: boolean;
}

function ChooseSection({
  onCreateStudent,
  familyCode,
  onFamilyCodeChange,
  onFamilyCodeSubmit,
  isSubmittingFamilyCode,
  familyCodeError,
  isDark,
}: ChooseSectionProps) {
  return (
    <>
      {/* Create Student Button */}
      <button
        type="button"
        onClick={onCreateStudent}
        data-action="create-student"
        className={css({
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          padding: "14px 16px",
          backgroundColor: isDark ? "green.700" : "green.500",
          color: "white",
          border: "none",
          borderRadius: "10px",
          fontSize: "1rem",
          fontWeight: "600",
          cursor: "pointer",
          transition: "all 0.15s ease",
          marginBottom: "12px",
          _hover: {
            backgroundColor: isDark ? "green.600" : "green.600",
            transform: "translateY(-1px)",
          },
          _active: {
            transform: "translateY(0)",
          },
        })}
      >
        <span className={css({ fontSize: "1.25rem" })}>+</span>
        Create Student
      </button>
      <p
        className={css({
          fontSize: "0.8125rem",
          color: isDark ? "gray.500" : "gray.500",
          textAlign: "center",
          marginBottom: "20px",
          lineHeight: "1.4",
        })}
      >
        Quick setup - student doesn't need an existing account
      </p>

      {/* Divider */}
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "20px",
        })}
      >
        <div
          className={css({
            flex: 1,
            height: "1px",
            backgroundColor: isDark ? "gray.700" : "gray.200",
          })}
        />
        <span
          className={css({
            fontSize: "0.75rem",
            color: isDark ? "gray.500" : "gray.400",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          })}
        >
          or
        </span>
        <div
          className={css({
            flex: 1,
            height: "1px",
            backgroundColor: isDark ? "gray.700" : "gray.200",
          })}
        />
      </div>

      {/* Family Code Section */}
      <div data-element="family-code-section">
        <label
          htmlFor="family-code-input"
          className={css({
            display: "block",
            fontSize: "0.875rem",
            fontWeight: "600",
            color: isDark ? "gray.300" : "gray.700",
            marginBottom: "8px",
          })}
        >
          Have a parent's family code?
        </label>
        <p
          className={css({
            fontSize: "0.8125rem",
            color: isDark ? "gray.500" : "gray.500",
            marginBottom: "12px",
            lineHeight: "1.4",
          })}
        >
          Enter their code to request enrollment. The parent will need to
          approve.
        </p>

        <div
          className={css({
            display: "flex",
            gap: "8px",
            marginBottom: familyCodeError ? "8px" : "0",
          })}
        >
          <input
            id="family-code-input"
            type="text"
            value={familyCode}
            onChange={(e) => onFamilyCodeChange(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                familyCode.trim() &&
                !isSubmittingFamilyCode
              ) {
                onFamilyCodeSubmit();
              }
            }}
            placeholder="e.g., ABCD-1234"
            data-element="family-code-input"
            className={css({
              flex: 1,
              padding: "10px 12px",
              fontSize: "1rem",
              fontFamily: "monospace",
              textAlign: "center",
              letterSpacing: "0.08em",
              backgroundColor: isDark ? "gray.700" : "white",
              border: "2px solid",
              borderColor: familyCodeError
                ? isDark
                  ? "red.500"
                  : "red.400"
                : isDark
                  ? "gray.600"
                  : "gray.300",
              borderRadius: "8px",
              color: isDark ? "white" : "gray.900",
              outline: "none",
              _focus: {
                borderColor: "blue.500",
                boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.2)",
              },
              _placeholder: {
                color: isDark ? "gray.500" : "gray.400",
              },
            })}
          />
          <button
            type="button"
            onClick={onFamilyCodeSubmit}
            disabled={isSubmittingFamilyCode || !familyCode.trim()}
            data-action="submit-family-code"
            className={css({
              padding: "10px 16px",
              backgroundColor: isDark ? "blue.700" : "blue.500",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "0.875rem",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap",
              _hover: {
                backgroundColor: isDark ? "blue.600" : "blue.600",
              },
              _disabled: {
                opacity: 0.5,
                cursor: "not-allowed",
              },
            })}
          >
            {isSubmittingFamilyCode ? "Adding..." : "Add"}
          </button>
        </div>

        {familyCodeError && (
          <div
            data-element="error-message"
            className={css({
              padding: "10px 12px",
              backgroundColor: isDark ? "red.900/30" : "red.50",
              border: "1px solid",
              borderColor: isDark ? "red.700" : "red.200",
              borderRadius: "8px",
              color: isDark ? "red.300" : "red.700",
              fontSize: "0.8125rem",
            })}
          >
            {familyCodeError}
          </div>
        )}
      </div>
    </>
  );
}

interface CreateStudentSectionProps {
  name: string;
  onNameChange: (name: string) => void;
  emoji: string;
  onEmojiClick: () => void;
  color: string;
  onColorChange: (color: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
  isDark: boolean;
}

function CreateStudentSection({
  name,
  onNameChange,
  emoji,
  onEmojiClick,
  color,
  onColorChange,
  onSubmit,
  onCancel,
  isPending,
  isDark,
}: CreateStudentSectionProps) {
  return (
    <div data-element="create-student-form">
      {/* Avatar Preview */}
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "6px",
          marginBottom: "16px",
        })}
      >
        <button
          type="button"
          onClick={onEmojiClick}
          data-element="avatar-preview"
          className={css({
            width: "72px",
            height: "72px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "2.25rem",
            boxShadow: "md",
            border: "3px solid",
            borderColor: isDark ? "gray.600" : "gray.300",
            cursor: "pointer",
            transition: "all 0.15s",
            _hover: {
              borderColor: "blue.500",
              transform: "scale(1.05)",
            },
          })}
          style={{ backgroundColor: color }}
          title="Click to choose avatar"
        >
          {emoji}
        </button>
        <span
          className={css({
            fontSize: "0.6875rem",
            color: isDark ? "gray.500" : "gray.400",
          })}
        >
          Tap to change
        </span>
      </div>

      {/* Name input */}
      <div className={css({ marginBottom: "12px" })}>
        <label
          htmlFor="student-name"
          className={css({
            display: "block",
            fontSize: "0.8125rem",
            fontWeight: "bold",
            color: isDark ? "gray.300" : "gray.700",
            marginBottom: "6px",
          })}
        >
          Name
        </label>
        <input
          id="student-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim() && !isPending) {
              onSubmit();
            }
          }}
          placeholder="Enter student name"
          // biome-ignore lint/a11y/noAutofocus: Form just shown, focusing input is expected UX
          autoFocus
          className={css({
            width: "100%",
            padding: "10px 12px",
            fontSize: "1rem",
            borderRadius: "8px",
            border: "1px solid",
            borderColor: isDark ? "gray.600" : "gray.300",
            backgroundColor: isDark ? "gray.700" : "white",
            color: isDark ? "gray.100" : "gray.800",
            _focus: {
              outline: "none",
              borderColor: "blue.500",
              boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.3)",
            },
          })}
        />
      </div>

      {/* Color selector */}
      <div className={css({ marginBottom: "16px" })}>
        <label
          className={css({
            display: "block",
            fontSize: "0.8125rem",
            fontWeight: "bold",
            color: isDark ? "gray.300" : "gray.700",
            marginBottom: "6px",
          })}
        >
          Color
        </label>
        <div
          className={css({
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
          })}
        >
          {AVAILABLE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onColorChange(c)}
              className={css({
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                border: "3px solid",
                borderColor: color === c ? "blue.500" : "transparent",
                cursor: "pointer",
                transition: "all 0.15s",
                _hover: {
                  transform: "scale(1.1)",
                },
              })}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Form actions */}
      <div
        className={css({
          display: "flex",
          gap: "8px",
        })}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          data-action="cancel-create"
          className={css({
            flex: 1,
            padding: "10px 12px",
            fontSize: "0.9375rem",
            color: isDark ? "gray.300" : "gray.600",
            backgroundColor: isDark ? "gray.700" : "gray.200",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            _hover: {
              backgroundColor: isDark ? "gray.600" : "gray.300",
            },
            _disabled: {
              opacity: 0.5,
              cursor: "not-allowed",
            },
          })}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending || !name.trim()}
          data-action="submit-create"
          className={css({
            flex: 2,
            padding: "10px 12px",
            fontSize: "0.9375rem",
            fontWeight: "bold",
            color: "white",
            backgroundColor: isPending ? "gray.400" : "green.500",
            borderRadius: "8px",
            border: "none",
            cursor: isPending ? "not-allowed" : "pointer",
            _hover: {
              backgroundColor: isPending ? "gray.400" : "green.600",
            },
            _disabled: {
              opacity: 0.5,
              cursor: "not-allowed",
            },
          })}
        >
          {isPending ? "Adding..." : "Add & Enroll"}
        </button>
      </div>
    </div>
  );
}

interface FamilyCodeSuccessProps {
  player: PlayerPreview;
  isDark: boolean;
  onAddAnother: () => void;
  onDone: () => void;
}

function FamilyCodeSuccess({
  player,
  isDark,
  onAddAnother,
  onDone,
}: FamilyCodeSuccessProps) {
  return (
    <div
      data-element="family-code-success"
      className={css({ textAlign: "center" })}
    >
      <div
        className={css({
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.75rem",
          margin: "0 auto 12px",
        })}
        style={{ backgroundColor: player.color }}
      >
        {player.emoji}
      </div>
      <h4
        className={css({
          fontSize: "1rem",
          fontWeight: "bold",
          color: isDark ? "white" : "gray.900",
          marginBottom: "4px",
        })}
      >
        Request Sent!
      </h4>
      <p
        className={css({
          fontSize: "0.875rem",
          color: isDark ? "gray.400" : "gray.600",
          marginBottom: "16px",
          lineHeight: "1.4",
        })}
      >
        <strong>{player.name}</strong> will be added once their parent approves.
      </p>
      <div className={css({ display: "flex", gap: "8px" })}>
        <button
          type="button"
          onClick={onAddAnother}
          data-action="add-another"
          className={css({
            flex: 1,
            padding: "10px 12px",
            backgroundColor: isDark ? "gray.700" : "gray.200",
            color: isDark ? "gray.300" : "gray.700",
            border: "none",
            borderRadius: "8px",
            fontSize: "0.875rem",
            fontWeight: "500",
            cursor: "pointer",
            _hover: {
              backgroundColor: isDark ? "gray.600" : "gray.300",
            },
          })}
        >
          Add Another
        </button>
        <button
          type="button"
          onClick={onDone}
          data-action="done"
          className={css({
            flex: 1,
            padding: "10px 12px",
            backgroundColor: isDark ? "green.700" : "green.500",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "0.875rem",
            fontWeight: "500",
            cursor: "pointer",
            _hover: {
              backgroundColor: isDark ? "green.600" : "green.600",
            },
          })}
        >
          Done
        </button>
      </div>
    </div>
  );
}
