"use client";

import { useCallback, useRef, useState } from "react";
import { useAudioManagerInstance } from "@/contexts/AudioManagerContext";
import type { CollectedClip } from "@/lib/audio/TtsAudioManager";
import { css } from "../../../styled-system/css";

const PRESET_TONES = [
  {
    label: "Math",
    value:
      "Speaking clearly and steadily, reading a math problem to a young child. Pause slightly between each number and operator.",
  },
  {
    label: "Celebration",
    value: "Warmly congratulating a child. Genuinely encouraging and happy.",
  },
  {
    label: "Corrective",
    value:
      "Gently guiding a child after a wrong answer. Kind, not disappointed.",
  },
  {
    label: "Tutorial",
    value:
      "Patiently guiding a young child through an abacus tutorial. Clear, slow, friendly.",
  },
];

const PRESET_PHRASES = [
  "five plus three",
  "ten minus four",
  "Correct!",
  "Great job!",
  "The answer is eight",
  "Welcome!",
  "Tap the bead",
  "forty two plus fifteen",
  "one hundred fifty seven minus twenty three",
];

export function TtsTestPanel() {
  const manager = useAudioManagerInstance();
  const [text, setText] = useState("");
  const [tone, setTone] = useState(PRESET_TONES[0].value);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [collection, setCollection] = useState<CollectedClip[]>([]);
  const [showCollection, setShowCollection] = useState(false);
  const [flushStatus, setFlushStatus] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const refreshCollection = useCallback(() => {
    setCollection(manager.getCollection());
    setShowCollection(true);
  }, [manager]);

  const handleSpeak = useCallback(async () => {
    if (!text.trim()) return;
    // Temporarily enable if disabled so the test panel always works
    const snap = manager.getSnapshot();
    const wasDisabled = !snap.isEnabled;
    if (wasDisabled) manager.configure({ enabled: true });

    setIsSpeaking(true);
    try {
      await manager.speak(text.trim(), tone);
    } finally {
      setIsSpeaking(false);
      if (wasDisabled) manager.configure({ enabled: false });
      refreshCollection();
    }
  }, [manager, text, tone, refreshCollection]);

  const handleStop = useCallback(() => {
    manager.stop();
    setIsSpeaking(false);
  }, [manager]);

  const handleFlush = useCallback(async () => {
    setFlushStatus("Flushing...");
    try {
      await manager.flush();
      setFlushStatus("Flushed to server");
      setTimeout(() => setFlushStatus(null), 2000);
    } catch {
      setFlushStatus("Flush failed");
      setTimeout(() => setFlushStatus(null), 3000);
    }
  }, [manager]);

  const handlePresetPhrase = useCallback((phrase: string) => {
    setText(phrase);
    textRef.current?.focus();
  }, []);

  const totalPlays = collection.reduce((sum, c) => sum + c.playCount, 0);

  return (
    <div
      data-component="TtsTestPanel"
      className={css({ padding: "0 16px 16px" })}
    >
      <p
        className={css({
          color: "#8b949e",
          fontSize: "13px",
          marginBottom: "16px",
        })}
      >
        Type text and pick a tone to test browser TTS. Each play registers the
        clip in the runtime collection. Flush sends the collection to the
        database.
      </p>

      {/* Input area */}
      <div
        data-element="tts-input"
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginBottom: "16px",
        })}
      >
        <textarea
          ref={textRef}
          data-element="tts-text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSpeak();
            }
          }}
          placeholder='Type something to speak, e.g. "five plus three"'
          rows={2}
          className={css({
            backgroundColor: "#0d1117",
            color: "#f0f6fc",
            border: "1px solid #30363d",
            borderRadius: "6px",
            padding: "10px 12px",
            fontSize: "14px",
            fontFamily: "inherit",
            resize: "vertical",
            "&::placeholder": { color: "#484f58" },
            "&:focus": {
              outline: "none",
              borderColor: "#58a6ff",
            },
          })}
        />

        {/* Preset phrases */}
        <div
          data-element="preset-phrases"
          className={css({
            display: "flex",
            flexWrap: "wrap",
            gap: "4px",
          })}
        >
          {PRESET_PHRASES.map((phrase) => (
            <button
              key={phrase}
              data-action="preset-phrase"
              onClick={() => handlePresetPhrase(phrase)}
              className={css({
                fontSize: "11px",
                backgroundColor: text === phrase ? "#1f6feb33" : "#0d1117",
                color: text === phrase ? "#58a6ff" : "#8b949e",
                border: "1px solid",
                borderColor: text === phrase ? "#1f6feb" : "#21262d",
                borderRadius: "12px",
                padding: "2px 10px",
                cursor: "pointer",
                "&:hover": { borderColor: "#30363d", color: "#c9d1d9" },
              })}
            >
              {phrase}
            </button>
          ))}
        </div>

        {/* Tone selector */}
        <div
          data-element="tone-selector"
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "8px",
          })}
        >
          <span
            className={css({
              color: "#8b949e",
              fontSize: "13px",
              flexShrink: 0,
            })}
          >
            Tone:
          </span>
          <div
            className={css({
              display: "flex",
              gap: "4px",
              flexWrap: "wrap",
            })}
          >
            {PRESET_TONES.map((t) => (
              <button
                key={t.label}
                data-action="preset-tone"
                onClick={() => setTone(t.value)}
                className={css({
                  fontSize: "12px",
                  backgroundColor:
                    tone === t.value ? "#1f6feb33" : "transparent",
                  color: tone === t.value ? "#58a6ff" : "#8b949e",
                  border: "1px solid",
                  borderColor: tone === t.value ? "#1f6feb" : "#30363d",
                  borderRadius: "6px",
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontWeight: tone === t.value ? "600" : "400",
                  "&:hover": { borderColor: "#58a6ff" },
                })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={css({
            fontSize: "11px",
            color: "#484f58",
            fontFamily: "monospace",
            padding: "4px 8px",
            backgroundColor: "#0d1117",
            borderRadius: "4px",
            maxHeight: "40px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          })}
          title={tone}
        >
          {tone}
        </div>

        {/* Action buttons */}
        <div
          data-element="tts-actions"
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "8px",
          })}
        >
          <button
            data-action="speak"
            onClick={handleSpeak}
            disabled={!text.trim() || isSpeaking}
            className={css({
              backgroundColor: "#238636",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "8px 20px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              "&:hover": { backgroundColor: "#2ea043" },
              "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
            })}
          >
            {isSpeaking ? "Speaking..." : "Speak"}
          </button>
          {isSpeaking && (
            <button
              data-action="stop"
              onClick={handleStop}
              className={css({
                backgroundColor: "transparent",
                color: "#f85149",
                border: "1px solid #f85149",
                borderRadius: "6px",
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                "&:hover": { backgroundColor: "#f8514922" },
              })}
            >
              Stop
            </button>
          )}
          <div className={css({ flex: 1 })} />
          <button
            data-action="show-collection"
            onClick={refreshCollection}
            className={css({
              fontSize: "12px",
              background: "none",
              border: "1px solid #30363d",
              color: "#8b949e",
              borderRadius: "6px",
              padding: "6px 12px",
              cursor: "pointer",
              "&:hover": { borderColor: "#8b949e" },
            })}
          >
            {showCollection ? "Refresh" : "Show"} Collection (
            {manager.getCollection().length})
          </button>
          <button
            data-action="flush-collection"
            onClick={handleFlush}
            disabled={flushStatus === "Flushing..."}
            className={css({
              fontSize: "12px",
              backgroundColor: "#1f6feb",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "6px 12px",
              cursor: "pointer",
              fontWeight: "600",
              "&:hover": { backgroundColor: "#388bfd" },
              "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
            })}
          >
            {flushStatus ?? "Flush to DB"}
          </button>
        </div>
      </div>

      {/* In-memory collection */}
      {showCollection && (
        <div data-element="in-memory-collection">
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            })}
          >
            <h4
              className={css({
                fontSize: "13px",
                fontWeight: "600",
                color: "#f0f6fc",
              })}
            >
              In-Memory Collection ({collection.length} entries, {totalPlays}{" "}
              total plays)
            </h4>
          </div>

          {collection.length === 0 ? (
            <p
              className={css({
                color: "#484f58",
                fontSize: "13px",
                fontStyle: "italic",
              })}
            >
              Empty. Speak something to populate it.
            </p>
          ) : (
            <table
              className={css({
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12px",
              })}
            >
              <thead>
                <tr>
                  {["Text", "Tone", "Plays", "Play"].map((header, idx) => (
                    <th
                      key={header}
                      className={css({
                        textAlign: idx >= 2 ? "center" : "left",
                        padding: "4px 8px",
                        color: "#8b949e",
                        borderBottom: "1px solid #30363d",
                        fontWeight: "500",
                        width: idx === 3 ? "50px" : undefined,
                      })}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {collection.map((clip, i) => (
                  <tr key={i}>
                    <td
                      className={css({
                        padding: "4px 8px",
                        borderBottom: "1px solid #21262d",
                        color: "#f0f6fc",
                      })}
                    >
                      {clip.text}
                    </td>
                    <td
                      className={css({
                        padding: "4px 8px",
                        borderBottom: "1px solid #21262d",
                        fontSize: "10px",
                        color: "#8b949e",
                        maxWidth: "180px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      })}
                      title={clip.tone}
                    >
                      {clip.tone}
                    </td>
                    <td
                      className={css({
                        padding: "4px 8px",
                        borderBottom: "1px solid #21262d",
                        textAlign: "center",
                        fontFamily: "monospace",
                        color: clip.playCount > 0 ? "#3fb950" : "#484f58",
                      })}
                    >
                      {clip.playCount}
                    </td>
                    <td
                      className={css({
                        padding: "4px 8px",
                        borderBottom: "1px solid #21262d",
                        textAlign: "center",
                      })}
                    >
                      <button
                        data-action="replay-collected"
                        onClick={async () => {
                          const snap = manager.getSnapshot();
                          const wasDisabled = !snap.isEnabled;
                          if (wasDisabled)
                            manager.configure({ enabled: true });
                          await manager.speak(clip.text, clip.tone);
                          if (wasDisabled)
                            manager.configure({ enabled: false });
                          refreshCollection();
                        }}
                        className={css({
                          background: "none",
                          border: "none",
                          color: "#c9d1d9",
                          cursor: "pointer",
                          fontSize: "14px",
                          "&:hover": { color: "#58a6ff" },
                        })}
                        title={`Play "${clip.text}"`}
                      >
                        &#9654;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
