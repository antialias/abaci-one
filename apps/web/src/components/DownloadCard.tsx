"use client";

import {
  Download,
  ExternalLink,
  FileText,
  Globe,
  Image,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { css } from "../../styled-system/css";
import { hstack, stack } from "../../styled-system/patterns";

interface GenerationResult {
  id: string;
  downloadUrl: string;
  metadata: {
    cardCount: number;
    numbers: number[];
    format: string;
    filename: string;
    fileSize: number;
  };
}

interface DownloadCardProps {
  result: GenerationResult;
  onNewGeneration: () => void;
}

export function DownloadCard({ result, onNewGeneration }: DownloadCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      // Trigger download
      const link = document.createElement("a");
      link.href = result.downloadUrl;
      link.download = result.metadata.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Optional: Track download success
      console.log("📥 Download started:", result.metadata.filename);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePreview = () => {
    window.open(result.downloadUrl, "_blank");
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
  };

  const getFormatIcon = (format: string) => {
    switch (format.toLowerCase()) {
      case "pdf":
        return <FileText size={20} />;
      case "html":
        return <Globe size={20} />;
      case "svg":
      case "png":
        return <Image size={20} />;
      default:
        return <FileText size={20} />;
    }
  };

  const getFormatColor = (format: string) => {
    switch (format.toLowerCase()) {
      case "pdf":
        return "red";
      case "html":
        return "blue";
      case "svg":
        return "purple";
      case "png":
        return "green";
      default:
        return "gray";
    }
  };

  const formatColor = getFormatColor(result.metadata.format);

  return (
    <div
      className={css({
        bg: "gradient-to-r from-green.50 to-emerald.50",
        border: "2px solid",
        borderColor: "green.200",
        rounded: "2xl",
        p: "8",
        position: "relative",
        overflow: "hidden",
      })}
    >
      {/* Success decoration */}
      <div
        className={css({
          position: "absolute",
          top: "-20px",
          right: "-20px",
          w: "40px",
          h: "40px",
          bg: "green.100",
          rounded: "full",
          opacity: 0.6,
        })}
      />

      <div className={stack({ gap: "6" })}>
        {/* Header */}
        <div className={hstack({ gap: "4", alignItems: "center" })}>
          <div
            className={css({
              w: "12",
              h: "12",
              bg: "green.100",
              rounded: "full",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <Sparkles size={24} className={css({ color: "green.600" })} />
          </div>

          <div className={stack({ gap: "1", flex: 1 })}>
            <h3
              className={css({
                fontSize: "xl",
                fontWeight: "bold",
                color: "gray.900",
              })}
            >
              ✨ Your Flashcards Are Ready!
            </h3>
            <p
              className={css({
                color: "gray.600",
              })}
            >
              Generated {result.metadata.cardCount} beautiful soroban flashcards
            </p>
          </div>
        </div>

        {/* File Details */}
        <div
          className={css({
            p: "4",
            bg: "white",
            rounded: "xl",
            border: "1px solid",
            borderColor: "gray.200",
          })}
        >
          <div className={hstack({ gap: "3", alignItems: "center", mb: "3" })}>
            <div
              className={css({
                p: "2",
                bg: `${formatColor}.100`,
                color: `${formatColor}.600`,
                rounded: "lg",
              })}
            >
              {getFormatIcon(result.metadata.format)}
            </div>

            <div className={stack({ gap: "0", flex: 1 })}>
              <div
                className={css({
                  fontSize: "sm",
                  fontWeight: "semibold",
                  color: "gray.900",
                  fontFamily: "mono",
                })}
              >
                {result.metadata.filename}
              </div>
              <div
                className={css({
                  fontSize: "xs",
                  color: "gray.600",
                })}
              >
                {result.metadata.format.toUpperCase()} •{" "}
                {formatFileSize(result.metadata.fileSize)}
              </div>
            </div>

            <div
              className={css({
                px: "3",
                py: "1",
                bg: `${formatColor}.100`,
                color: `${formatColor}.800`,
                fontSize: "xs",
                fontWeight: "medium",
                rounded: "full",
              })}
            >
              {result.metadata.cardCount} cards
            </div>
          </div>

          {/* Sample Numbers */}
          <div className={stack({ gap: "2" })}>
            <div
              className={css({
                fontSize: "xs",
                fontWeight: "medium",
                color: "gray.700",
              })}
            >
              Sample numbers:
            </div>
            <div
              className={css({
                display: "flex",
                flexWrap: "wrap",
                gap: "1",
              })}
            >
              {result.metadata.numbers.slice(0, 8).map((number, i) => (
                <span
                  key={i}
                  className={css({
                    px: "2",
                    py: "1",
                    bg: "gray.100",
                    color: "gray.700",
                    fontSize: "xs",
                    fontFamily: "mono",
                    rounded: "md",
                  })}
                >
                  {number}
                </span>
              ))}
              {result.metadata.numbers.length > 8 && (
                <span
                  className={css({
                    px: "2",
                    py: "1",
                    color: "gray.500",
                    fontSize: "xs",
                  })}
                >
                  +{result.metadata.numbers.length - 8} more
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={hstack({ gap: "3" })}>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={css({
              flex: 1,
              px: "6",
              py: "4",
              bg: "green.600",
              color: "white",
              fontSize: "lg",
              fontWeight: "semibold",
              rounded: "xl",
              shadow: "card",
              transition: "all",
              cursor: isDownloading ? "not-allowed" : "pointer",
              opacity: isDownloading ? "0.7" : "1",
              _hover: isDownloading
                ? {}
                : {
                    bg: "green.700",
                    transform: "translateY(-1px)",
                    shadow: "modal",
                  },
            })}
          >
            <span className={hstack({ gap: "3", justify: "center" })}>
              {isDownloading ? (
                <>
                  <div
                    className={css({
                      w: "5",
                      h: "5",
                      border: "2px solid",
                      borderColor: "white",
                      borderTopColor: "transparent",
                      rounded: "full",
                      animation: "spin 1s linear infinite",
                    })}
                  />
                  Downloading...
                </>
              ) : (
                <>
                  <Download size={20} />
                  Download
                </>
              )}
            </span>
          </button>

          {result.metadata.format === "html" && (
            <button
              onClick={handlePreview}
              className={css({
                px: "4",
                py: "4",
                bg: "white",
                color: "blue.600",
                fontSize: "lg",
                fontWeight: "semibold",
                rounded: "xl",
                shadow: "card",
                border: "2px solid",
                borderColor: "blue.200",
                transition: "all",
                _hover: {
                  borderColor: "blue.400",
                  transform: "translateY(-1px)",
                },
              })}
            >
              <ExternalLink size={20} />
            </button>
          )}
        </div>

        {/* New Generation Button */}
        <div
          className={css({
            pt: "4",
            borderTop: "1px solid",
            borderColor: "green.200",
          })}
        >
          <button
            onClick={onNewGeneration}
            className={css({
              w: "full",
              px: "4",
              py: "3",
              bg: "transparent",
              color: "green.700",
              fontSize: "sm",
              fontWeight: "medium",
              rounded: "lg",
              border: "1px solid",
              borderColor: "green.300",
              transition: "all",
              _hover: {
                bg: "green.100",
                borderColor: "green.400",
              },
            })}
          >
            Create Another Set
          </button>
        </div>
      </div>

      {/* Success celebration effect */}
      <div
        className={css({
          position: "absolute",
          top: "4",
          right: "4",
          fontSize: "2xl",
          opacity: 0.3,
        })}
      >
        🎉
      </div>
    </div>
  );
}
