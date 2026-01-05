"use client";

import { useEffect } from "react";
import { PageWithNav } from "@/components/PageWithNav";
import { css } from "../../../styled-system/css";

export default function ArcadeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Arcade Error Boundary]", error);
  }, [error]);

  return (
    <PageWithNav navTitle="Error" navEmoji="⚠️">
      <div
        data-component="arcade-error-page"
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          padding: "32px",
          textAlign: "center",
        })}
      >
        {/* Error icon */}
        <div
          className={css({
            fontSize: "64px",
            marginBottom: "24px",
          })}
        >
          ⚠️
        </div>

        {/* Error title */}
        <h1
          className={css({
            fontSize: "32px",
            fontWeight: "bold",
            marginBottom: "16px",
          })}
        >
          Something Went Wrong
        </h1>

        {/* Error message */}
        <p
          className={css({
            fontSize: "18px",
            color: "gray.600",
            marginBottom: "32px",
            maxWidth: "600px",
          })}
        >
          The game encountered an unexpected error. You can try reloading the
          game, or return to the arcade lobby.
        </p>

        {/* Action buttons */}
        <div
          className={css({
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
            justifyContent: "center",
          })}
        >
          <button
            onClick={reset}
            data-action="retry-game"
            className={css({
              padding: "12px 32px",
              backgroundColor: "blue.600",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "background-color 0.2s",
              _hover: {
                backgroundColor: "blue.700",
              },
            })}
          >
            Try Again
          </button>

          <a
            href="/arcade-rooms"
            data-action="return-to-lobby"
            className={css({
              padding: "12px 32px",
              backgroundColor: "gray.200",
              color: "gray.800",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: "pointer",
              textDecoration: "none",
              transition: "background-color 0.2s",
              _hover: {
                backgroundColor: "gray.300",
              },
            })}
          >
            Return to Lobby
          </a>
        </div>

        {/* Technical details (collapsed by default) */}
        <details
          className={css({
            marginTop: "48px",
            maxWidth: "600px",
            width: "100%",
          })}
        >
          <summary
            className={css({
              cursor: "pointer",
              fontSize: "14px",
              color: "gray.600",
              _hover: {
                color: "gray.800",
              },
            })}
          >
            Show technical details
          </summary>

          <div
            className={css({
              marginTop: "16px",
              padding: "16px",
              backgroundColor: "gray.100",
              borderRadius: "8px",
              textAlign: "left",
            })}
          >
            <div
              className={css({
                fontSize: "14px",
                fontWeight: "bold",
                marginBottom: "8px",
              })}
            >
              Error: {error.message}
            </div>

            {error.digest && (
              <div
                className={css({
                  fontSize: "12px",
                  color: "gray.600",
                  marginBottom: "8px",
                })}
              >
                Digest: {error.digest}
              </div>
            )}

            {error.stack && (
              <pre
                className={css({
                  fontSize: "12px",
                  fontFamily: "monospace",
                  color: "gray.700",
                  overflow: "auto",
                  maxHeight: "200px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                })}
              >
                {error.stack}
              </pre>
            )}
          </div>
        </details>
      </div>
    </PageWithNav>
  );
}
