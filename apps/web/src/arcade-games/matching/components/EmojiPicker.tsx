"use client";

import emojiData from "emojibase-data/en/data.json";
import { useMemo, useState } from "react";
import { css } from "../../../../styled-system/css";
import { PLAYER_EMOJIS } from "@/constants/playerEmojis";

// Proper TypeScript interface for emojibase-data structure
interface EmojibaseEmoji {
  label: string;
  hexcode: string;
  tags?: string[];
  emoji: string;
  text: string;
  type: number;
  order: number;
  group: number;
  subgroup: number;
  version: number;
  emoticon?: string | string[]; // Can be string, array, or undefined
}

interface EmojiPickerProps {
  currentEmoji: string;
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  playerNumber: number;
}

// Emoji group categories from emojibase (matching Unicode CLDR group IDs)
const EMOJI_GROUPS = {
  0: { name: "Smileys & Emotion", icon: "😀" },
  1: { name: "People & Body", icon: "👤" },
  3: { name: "Animals & Nature", icon: "🐶" },
  4: { name: "Food & Drink", icon: "🍎" },
  5: { name: "Travel & Places", icon: "🚗" },
  6: { name: "Activities", icon: "⚽" },
  7: { name: "Objects", icon: "💡" },
  8: { name: "Symbols", icon: "❤️" },
  9: { name: "Flags", icon: "🏁" },
} as const;

// Create a map of emoji to their searchable data and group
const emojiMap = new Map<string, { keywords: string[]; group: number }>();
(emojiData as EmojibaseEmoji[]).forEach((emoji) => {
  if (emoji.emoji) {
    // Handle emoticon field which can be string, array, or undefined
    const emoticons: string[] = [];
    if (emoji.emoticon) {
      if (Array.isArray(emoji.emoticon)) {
        emoticons.push(...emoji.emoticon.map((e) => e.toLowerCase()));
      } else {
        emoticons.push(emoji.emoticon.toLowerCase());
      }
    }

    emojiMap.set(emoji.emoji, {
      keywords: [
        emoji.label?.toLowerCase(),
        ...(emoji.tags || []).map((tag: string) => tag.toLowerCase()),
        ...emoticons,
      ].filter(Boolean),
      group: emoji.group,
    });
  }
});

// Enhanced search function using emojibase-data
function getEmojiKeywords(emoji: string): string[] {
  const data = emojiMap.get(emoji);
  if (data) {
    return data.keywords;
  }

  // Fallback categories for emojis not in emojibase-data
  if (/[\u{1F600}-\u{1F64F}]/u.test(emoji))
    return ["face", "emotion", "person", "expression"];
  if (/[\u{1F400}-\u{1F43F}]/u.test(emoji))
    return ["animal", "nature", "cute", "pet"];
  if (/[\u{1F440}-\u{1F4FF}]/u.test(emoji)) return ["object", "symbol", "tool"];
  if (/[\u{1F300}-\u{1F3FF}]/u.test(emoji))
    return ["nature", "travel", "activity", "place"];
  if (/[\u{1F680}-\u{1F6FF}]/u.test(emoji))
    return ["transport", "travel", "vehicle"];
  if (/[\u{2600}-\u{26FF}]/u.test(emoji)) return ["symbol", "misc", "sign"];

  return ["misc", "other"];
}

export function EmojiPicker({
  currentEmoji,
  onEmojiSelect,
  onClose,
  playerNumber,
}: EmojiPickerProps) {
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

  // Enhanced search functionality - clear separation between default and search
  const isSearching = searchFilter.trim().length > 0;
  const isCategoryFiltered = selectedCategory !== null && !isSearching;

  // Calculate which categories have emojis
  const availableCategories = useMemo(() => {
    const categoryCounts: Record<number, number> = {};
    PLAYER_EMOJIS.forEach((emoji) => {
      const data = emojiMap.get(emoji);
      if (data && data.group !== undefined) {
        categoryCounts[data.group] = (categoryCounts[data.group] || 0) + 1;
      }
    });
    return Object.keys(EMOJI_GROUPS)
      .map(Number)
      .filter((groupId) => categoryCounts[groupId] > 0);
  }, []);

  const displayEmojis = useMemo(() => {
    // Start with all emojis
    let emojis = PLAYER_EMOJIS;

    // Apply category filter first (unless searching)
    if (isCategoryFiltered) {
      emojis = emojis.filter((emoji) => {
        const data = emojiMap.get(emoji);
        return data && data.group === selectedCategory;
      });
    }

    // Then apply search filter
    if (!isSearching) {
      return emojis;
    }

    const searchTerm = searchFilter.toLowerCase().trim();

    const results = PLAYER_EMOJIS.filter((emoji) => {
      const keywords = getEmojiKeywords(emoji);
      return keywords.some((keyword) => keyword?.includes(searchTerm));
    });

    // Sort results by relevance
    const sortedResults = results.sort((a, b) => {
      const aKeywords = getEmojiKeywords(a);
      const bKeywords = getEmojiKeywords(b);

      // Exact match priority
      const aExact = aKeywords.some((k) => k === searchTerm);
      const bExact = bKeywords.some((k) => k === searchTerm);

      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Word boundary matches (start of word)
      const aStartsWithTerm = aKeywords.some((k) => k?.startsWith(searchTerm));
      const bStartsWithTerm = bKeywords.some((k) => k?.startsWith(searchTerm));

      if (aStartsWithTerm && !bStartsWithTerm) return -1;
      if (!aStartsWithTerm && bStartsWithTerm) return 1;

      // Score by number of matching keywords
      const aScore = aKeywords.filter((k) => k?.includes(searchTerm)).length;
      const bScore = bKeywords.filter((k) => k?.includes(searchTerm)).length;

      return bScore - aScore;
    });

    return sortedResults;
  }, [searchFilter, isSearching, selectedCategory, isCategoryFiltered]);

  return (
    <div
      className={css({
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        animation: "fadeIn 0.2s ease",
        padding: "20px",
      })}
    >
      <div
        className={css({
          background: "white",
          borderRadius: "20px",
          padding: "24px",
          width: "90vw",
          height: "90vh",
          maxWidth: "1200px",
          maxHeight: "800px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        })}
      >
        {/* Header */}
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            borderBottom: "2px solid",
            borderColor: "gray.100",
            paddingBottom: "12px",
            flexShrink: 0,
          })}
        >
          <h3
            className={css({
              fontSize: "18px",
              fontWeight: "bold",
              color: "gray.800",
              margin: 0,
            })}
          >
            Choose Character for Player {playerNumber}
          </h3>
          <button
            className={css({
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "gray.500",
              _hover: { color: "gray.700" },
              padding: "4px",
            })}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Current Selection & Search */}
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "16px",
            flexShrink: 0,
          })}
        >
          <div
            className={css({
              padding: "8px 12px",
              background:
                playerNumber === 1
                  ? "linear-gradient(135deg, #74b9ff, #0984e3)"
                  : playerNumber === 2
                    ? "linear-gradient(135deg, #fd79a8, #e84393)"
                    : playerNumber === 3
                      ? "linear-gradient(135deg, #a78bfa, #8b5cf6)"
                      : "linear-gradient(135deg, #fbbf24, #f59e0b)",
              borderRadius: "12px",
              color: "white",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
            })}
          >
            <div className={css({ fontSize: "24px" })}>{currentEmoji}</div>
            <div className={css({ fontSize: "12px", fontWeight: "bold" })}>
              Current
            </div>
          </div>

          <input
            type="text"
            placeholder="Search: face, smart, heart, animal, food..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className={css({
              flex: 1,
              padding: "8px 12px",
              border: "2px solid",
              borderColor: "gray.200",
              borderRadius: "12px",
              fontSize: "14px",
              _focus: {
                outline: "none",
                borderColor: "blue.400",
                boxShadow: "0 0 0 3px rgba(66, 153, 225, 0.1)",
              },
            })}
          />

          {isSearching && (
            <div
              className={css({
                fontSize: "12px",
                color: "gray.600",
                flexShrink: 0,
                padding: "4px 8px",
                background: displayEmojis.length > 0 ? "green.100" : "red.100",
                borderRadius: "8px",
                border: "1px solid",
                borderColor: displayEmojis.length > 0 ? "green.300" : "red.300",
              })}
            >
              {displayEmojis.length > 0
                ? `✓ ${displayEmojis.length} found`
                : "✗ No matches"}
            </div>
          )}
        </div>

        {/* Category Tabs */}
        {!isSearching && (
          <div
            className={css({
              display: "flex",
              gap: "8px",
              overflowX: "auto",
              paddingBottom: "8px",
              marginBottom: "12px",
              flexShrink: 0,
              "&::-webkit-scrollbar": {
                height: "6px",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "#cbd5e1",
                borderRadius: "3px",
              },
            })}
          >
            <button
              onClick={() => setSelectedCategory(null)}
              className={css({
                padding: "8px 16px",
                borderRadius: "20px",
                border:
                  selectedCategory === null
                    ? "2px solid #3b82f6"
                    : "2px solid #e5e7eb",
                background: selectedCategory === null ? "#eff6ff" : "white",
                color: selectedCategory === null ? "#1e40af" : "#6b7280",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s ease",
                _hover: {
                  background: selectedCategory === null ? "#dbeafe" : "#f9fafb",
                  transform: "translateY(-1px)",
                },
              })}
            >
              ✨ All
            </button>
            {availableCategories.map((groupId) => {
              const group = EMOJI_GROUPS[groupId as keyof typeof EMOJI_GROUPS];
              return (
                <button
                  key={groupId}
                  onClick={() => setSelectedCategory(Number(groupId))}
                  className={css({
                    padding: "8px 16px",
                    borderRadius: "20px",
                    border:
                      selectedCategory === Number(groupId)
                        ? "2px solid #3b82f6"
                        : "2px solid #e5e7eb",
                    background:
                      selectedCategory === Number(groupId)
                        ? "#eff6ff"
                        : "white",
                    color:
                      selectedCategory === Number(groupId)
                        ? "#1e40af"
                        : "#6b7280",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.2s ease",
                    _hover: {
                      background:
                        selectedCategory === Number(groupId)
                          ? "#dbeafe"
                          : "#f9fafb",
                      transform: "translateY(-1px)",
                    },
                  })}
                >
                  {group.icon} {group.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Search Mode Header */}
        {isSearching && displayEmojis.length > 0 && (
          <div
            className={css({
              padding: "8px 12px",
              background: "blue.50",
              border: "1px solid",
              borderColor: "blue.200",
              borderRadius: "8px",
              marginBottom: "12px",
              flexShrink: 0,
            })}
          >
            <div
              className={css({
                fontSize: "14px",
                fontWeight: "bold",
                color: "blue.700",
                marginBottom: "4px",
              })}
            >
              🔍 Search Results for "{searchFilter}"
            </div>
            <div
              className={css({
                fontSize: "12px",
                color: "blue.600",
              })}
            >
              Showing {displayEmojis.length} of {PLAYER_EMOJIS.length} emojis •
              Clear search to see all
            </div>
          </div>
        )}

        {/* Default Mode Header */}
        {!isSearching && (
          <div
            className={css({
              padding: "8px 12px",
              background: "gray.50",
              border: "1px solid",
              borderColor: "gray.200",
              borderRadius: "8px",
              marginBottom: "12px",
              flexShrink: 0,
            })}
          >
            <div
              className={css({
                fontSize: "14px",
                fontWeight: "bold",
                color: "gray.700",
                marginBottom: "4px",
              })}
            >
              {selectedCategory !== null
                ? `${EMOJI_GROUPS[selectedCategory as keyof typeof EMOJI_GROUPS].icon} ${EMOJI_GROUPS[selectedCategory as keyof typeof EMOJI_GROUPS].name}`
                : "📝 All Available Characters"}
            </div>
            <div
              className={css({
                fontSize: "12px",
                color: "gray.600",
              })}
            >
              {displayEmojis.length} emojis{" "}
              {selectedCategory !== null ? "in category" : "available"} • Use
              search to find specific emojis
            </div>
          </div>
        )}

        {/* Emoji Grid - Only show when there are emojis to display */}
        {displayEmojis.length > 0 && (
          <div
            className={css({
              flex: 1,
              overflowY: "auto",
              minHeight: 0,
              "&::-webkit-scrollbar": {
                width: "10px",
              },
              "&::-webkit-scrollbar-track": {
                background: "#f1f5f9",
                borderRadius: "5px",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "#cbd5e1",
                borderRadius: "5px",
                "&:hover": {
                  background: "#94a3b8",
                },
              },
            })}
          >
            <div
              className={css({
                display: "grid",
                gridTemplateColumns: "repeat(16, 1fr)",
                gap: "4px",
                padding: "4px",
                "@media (max-width: 1200px)": {
                  gridTemplateColumns: "repeat(14, 1fr)",
                },
                "@media (max-width: 1000px)": {
                  gridTemplateColumns: "repeat(12, 1fr)",
                },
                "@media (max-width: 800px)": {
                  gridTemplateColumns: "repeat(10, 1fr)",
                },
                "@media (max-width: 600px)": {
                  gridTemplateColumns: "repeat(8, 1fr)",
                },
              })}
            >
              {displayEmojis.map((emoji) => {
                const isSelected = emoji === currentEmoji;
                const getSelectedBg = () => {
                  if (!isSelected) return "transparent";
                  if (playerNumber === 1) return "blue.100";
                  if (playerNumber === 2) return "pink.100";
                  if (playerNumber === 3) return "purple.100";
                  return "yellow.100";
                };
                const getSelectedBorder = () => {
                  if (!isSelected) return "transparent";
                  if (playerNumber === 1) return "blue.400";
                  if (playerNumber === 2) return "pink.400";
                  if (playerNumber === 3) return "purple.400";
                  return "yellow.400";
                };
                const getHoverBg = () => {
                  if (!isSelected) return "gray.100";
                  if (playerNumber === 1) return "blue.200";
                  if (playerNumber === 2) return "pink.200";
                  if (playerNumber === 3) return "purple.200";
                  return "yellow.200";
                };
                return (
                  <button
                    key={emoji}
                    className={css({
                      aspectRatio: "1",
                      background: getSelectedBg(),
                      border: "2px solid",
                      borderColor: getSelectedBorder(),
                      borderRadius: "6px",
                      fontSize: "20px",
                      cursor: "pointer",
                      transition: "all 0.1s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      _hover: {
                        background: getHoverBg(),
                        transform: "scale(1.15)",
                        zIndex: 1,
                        fontSize: "24px",
                      },
                    })}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredEmoji(emoji);
                      setHoverPosition({
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                    onMouseLeave={() => setHoveredEmoji(null)}
                    onClick={() => {
                      onEmojiSelect(emoji);
                    }}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* No results message */}
        {isSearching && displayEmojis.length === 0 && (
          <div
            className={css({
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              color: "gray.500",
            })}
          >
            <div className={css({ fontSize: "48px", marginBottom: "16px" })}>
              🔍
            </div>
            <div
              className={css({
                fontSize: "18px",
                fontWeight: "bold",
                marginBottom: "8px",
              })}
            >
              No emojis found for "{searchFilter}"
            </div>
            <div className={css({ fontSize: "14px", marginBottom: "12px" })}>
              Try searching for "face", "smart", "heart", "animal", "food", etc.
            </div>
            <button
              className={css({
                background: "blue.500",
                color: "white",
                border: "none",
                borderRadius: "6px",
                padding: "8px 16px",
                fontSize: "12px",
                cursor: "pointer",
                _hover: { background: "blue.600" },
              })}
              onClick={() => setSearchFilter("")}
            >
              Clear search to see all {PLAYER_EMOJIS.length} emojis
            </button>
          </div>
        )}

        {/* Quick selection hint */}
        <div
          className={css({
            marginTop: "8px",
            padding: "6px 12px",
            background: "gray.50",
            borderRadius: "8px",
            fontSize: "11px",
            color: "gray.600",
            textAlign: "center",
            flexShrink: 0,
          })}
        >
          💡 Powered by emojibase-data • Try: "face", "smart", "heart",
          "animal", "food" • Click to select
        </div>
      </div>

      {/* Magnifying Glass Preview - SUPER POWERED! */}
      {hoveredEmoji && (
        <div
          style={{
            position: "fixed",
            left: `${hoverPosition.x}px`,
            top: `${hoverPosition.y - 120}px`,
            transform: "translateX(-50%)",
            pointerEvents: "none",
            zIndex: 10000,
            animation: "magnifyIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {/* Outer glow ring */}
          <div
            style={{
              position: "absolute",
              inset: "-20px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)",
              animation: "pulseGlow 2s ease-in-out infinite",
            }}
          />

          {/* Main preview card */}
          <div
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
              borderRadius: "24px",
              padding: "20px",
              boxShadow:
                "0 20px 60px rgba(0, 0, 0, 0.4), 0 0 0 4px rgba(59, 130, 246, 0.6), inset 0 2px 4px rgba(255,255,255,0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "120px",
              lineHeight: 1,
              minWidth: "160px",
              minHeight: "160px",
              position: "relative",
              animation: "emojiFloat 3s ease-in-out infinite",
            }}
          >
            {/* Sparkle effects */}
            <div
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                fontSize: "20px",
                animation: "sparkle 1.5s ease-in-out infinite",
                animationDelay: "0s",
              }}
            >
              ✨
            </div>
            <div
              style={{
                position: "absolute",
                bottom: "15px",
                left: "15px",
                fontSize: "16px",
                animation: "sparkle 1.5s ease-in-out infinite",
                animationDelay: "0.5s",
              }}
            >
              ✨
            </div>
            <div
              style={{
                position: "absolute",
                top: "20px",
                left: "20px",
                fontSize: "12px",
                animation: "sparkle 1.5s ease-in-out infinite",
                animationDelay: "1s",
              }}
            >
              ✨
            </div>

            {hoveredEmoji}
          </div>

          {/* Arrow pointing down with glow */}
          <div
            style={{
              position: "absolute",
              bottom: "-12px",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "14px solid transparent",
              borderRight: "14px solid transparent",
              borderTop: "14px solid white",
              filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))",
            }}
          />
        </div>
      )}

      {/* Add magnifying animations */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes magnifyIn {
          from {
            opacity: 0;
            transform: translateX(-50%) scale(0.5);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) scale(1);
          }
        }
        @keyframes pulseGlow {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }
        @keyframes emojiFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        @keyframes sparkle {
          0%, 100% {
            opacity: 0;
            transform: scale(0.5) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: scale(1) rotate(180deg);
          }
        }
      `,
        }}
      />
    </div>
  );
}

// Add fade in animation
const fadeInAnimation = `
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
`;

// Inject animation styles
if (
  typeof document !== "undefined" &&
  !document.getElementById("emoji-picker-animations")
) {
  const style = document.createElement("style");
  style.id = "emoji-picker-animations";
  style.textContent = fadeInAnimation;
  document.head.appendChild(style);
}
