import { useTranslations } from "next-intl";
import { css } from "../../../../../styled-system/css";
import { PieceRenderer } from "../PieceRenderer";
import { RithmomachiaBoard } from "../RithmomachiaBoard";
import type { PieceType } from "../../types";

/**
 * Helper to convert square names to crop area coordinates
 * @param topLeft - e.g. 'D3'
 * @param bottomRight - e.g. 'H6'
 */
function squaresToCropArea(topLeft: string, bottomRight: string) {
  const minCol = topLeft.charCodeAt(0) - 65; // A=0
  const maxCol = bottomRight.charCodeAt(0) - 65;
  const maxRow = Number.parseInt(topLeft.slice(1), 10);
  const minRow = Number.parseInt(bottomRight.slice(1), 10);
  return { minCol, maxCol, minRow, maxRow };
}

export function PiecesSection({
  useNativeAbacusNumbers,
}: {
  useNativeAbacusNumbers: boolean;
}) {
  const t = useTranslations("rithmomachia.guide");
  const pieces: {
    type: PieceType;
    name: string;
    movement: string;
    chessAnalogy: string;
    count: number;
    exampleValue: number;
  }[] = [
    {
      type: "C",
      name: t("pieces.circle"),
      movement: t("pieces.circleMove"),
      chessAnalogy: "like a bishop",
      count: 8,
      exampleValue: 64,
    },
    {
      type: "T",
      name: t("pieces.triangle"),
      movement: t("pieces.triangleMove"),
      chessAnalogy: "like a rook",
      count: 8,
      exampleValue: 64,
    },
    {
      type: "S",
      name: t("pieces.square"),
      movement: t("pieces.squareMove"),
      chessAnalogy: "like a queen",
      count: 7,
      exampleValue: 64,
    },
    {
      type: "P",
      name: t("pieces.pyramidTitle"),
      movement: t("pieces.pyramidMovement"),
      chessAnalogy: "like a king",
      count: 1,
      exampleValue: 64,
    },
  ];

  return (
    <div data-section="pieces">
      <h3
        className={css({
          fontSize: { base: "20px", md: "24px" },
          fontWeight: "bold",
          color: "#7c2d12",
          mb: "16px",
        })}
      >
        {t("pieces.title")}
      </h3>
      <p className={css({ fontSize: "15px", mb: "24px", color: "#374151" })}>
        {t("pieces.description")}
      </p>

      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        })}
      >
        {pieces.map((piece) => (
          <div
            key={piece.type}
            className={css({
              p: "16px",
              bg: "#f9fafb",
              borderRadius: "8px",
              border: "2px solid #e5e7eb",
            })}
          >
            <div
              className={css({
                display: "flex",
                alignItems: "flex-start",
                gap: "16px",
              })}
            >
              <div
                className={css({
                  width: "80px",
                  height: "80px",
                  flexShrink: 0,
                })}
              >
                <PieceRenderer
                  type={piece.type}
                  color="W"
                  value={piece.exampleValue}
                  size={80}
                  useNativeAbacusNumbers={useNativeAbacusNumbers}
                />
              </div>
              <div className={css({ flex: 1, pt: "4px" })}>
                <div
                  className={css({
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#111827",
                    mb: "4px",
                  })}
                >
                  {piece.exampleValue}
                </div>
                <h4
                  className={css({
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: "#111827",
                    mb: "6px",
                  })}
                >
                  {piece.name}
                </h4>
                <p
                  className={css({
                    fontSize: "14px",
                    color: "#6b7280",
                    mb: "4px",
                  })}
                >
                  {piece.movement}{" "}
                  <span className={css({ fontStyle: "italic" })}>
                    {piece.chessAnalogy}
                  </span>
                </p>
                <p
                  className={css({
                    fontSize: "13px",
                    color: "#9ca3af",
                    fontWeight: "600",
                  })}
                >
                  Count: {piece.count}
                  {piece.count > 1 ? " per side" : ""}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pyramid section */}
      <div
        className={css({
          mt: "32px",
          p: "20px",
          bg: "rgba(251, 191, 36, 0.1)",
          borderLeft: "4px solid #f59e0b",
          borderRadius: "4px",
        })}
      >
        <h4
          className={css({
            fontSize: "18px",
            fontWeight: "bold",
            color: "#92400e",
            mb: "12px",
          })}
        >
          {t("pieces.pyramidTitle")}
        </h4>
        <p
          className={css({
            fontSize: "14px",
            color: "#78350f",
            lineHeight: "1.6",
            mb: "16px",
          })}
        >
          {t("pieces.pyramidIntro")}
        </p>

        <div
          className={css({
            display: "flex",
            gap: "32px",
            flexWrap: "wrap",
            mt: "16px",
            mb: "20px",
          })}
        >
          {/* Black Pyramid */}
          <div>
            <p
              className={css({
                fontSize: "13px",
                fontWeight: "bold",
                color: "#92400e",
                mb: "8px",
                textAlign: "center",
              })}
            >
              {t("pieces.blackPyramid")}:
            </p>
            <div
              className={css({
                width: "80px",
                height: "80px",
                margin: "0 auto",
              })}
            >
              <PieceRenderer
                type="P"
                color="B"
                value="P"
                size={80}
                useNativeAbacusNumbers={useNativeAbacusNumbers}
              />
            </div>
            <p
              className={css({
                fontSize: "13px",
                color: "#78350f",
                mt: "8px",
                textAlign: "center",
                fontWeight: "bold",
              })}
            >
              {t("pieces.blackPyramidValues")}
            </p>
          </div>

          {/* White Pyramid */}
          <div>
            <p
              className={css({
                fontSize: "13px",
                fontWeight: "bold",
                color: "#92400e",
                mb: "8px",
                textAlign: "center",
              })}
            >
              {t("pieces.whitePyramid")}:
            </p>
            <div
              className={css({
                width: "80px",
                height: "80px",
                margin: "0 auto",
              })}
            >
              <PieceRenderer
                type="P"
                color="W"
                value="P"
                size={80}
                useNativeAbacusNumbers={useNativeAbacusNumbers}
              />
            </div>
            <p
              className={css({
                fontSize: "13px",
                color: "#78350f",
                mt: "8px",
                textAlign: "center",
                fontWeight: "bold",
              })}
            >
              {t("pieces.whitePyramidValues")}
            </p>
          </div>
        </div>

        {/* How face selection works */}
        <div
          className={css({
            bg: "white",
            p: "16px",
            borderRadius: "6px",
            mb: "16px",
            border: "1px solid #fbbf24",
          })}
        >
          <p
            className={css({
              fontSize: "14px",
              fontWeight: "bold",
              color: "#92400e",
              mb: "12px",
            })}
          >
            {t("pieces.pyramidHowItWorks")}
          </p>
          <ul
            className={css({
              fontSize: "13px",
              color: "#78350f",
              lineHeight: "1.8",
              pl: "20px",
            })}
          >
            <li>{t("pieces.pyramidRule1")}</li>
            <li>{t("pieces.pyramidRule2")}</li>
            <li>{t("pieces.pyramidRule3")}</li>
            <li>{t("pieces.pyramidRule4")}</li>
          </ul>
        </div>

        {/* Example */}
        <div
          className={css({
            bg: "rgba(146, 64, 14, 0.1)",
            p: "12px",
            borderRadius: "6px",
            mb: "20px",
          })}
        >
          <p
            className={css({
              fontSize: "13px",
              color: "#78350f",
              lineHeight: "1.6",
            })}
          >
            <strong>{t("pieces.example")}</strong> {t("pieces.pyramidExample")}
          </p>
        </div>

        {/* Visual Example */}
        <div>
          <h5
            className={css({
              fontSize: "15px",
              fontWeight: "bold",
              color: "#92400e",
              mb: "12px",
            })}
          >
            {t("pieces.pyramidVisualTitle")}
          </h5>
          <p
            className={css({
              fontSize: "13px",
              color: "#78350f",
              mb: "12px",
              lineHeight: "1.6",
            })}
          >
            {t("pieces.pyramidVisualDesc")}
          </p>

          <div
            className={css({
              display: "flex",
              justifyContent: "center",
              mb: "12px",
            })}
          >
            <RithmomachiaBoard
              pieces={[
                // White Pyramid at H5
                { square: "H5", type: "P", color: "W", value: 49 },
                // Black pieces that can be captured
                { square: "I5", type: "T", color: "B", value: 16 },
                { square: "H6", type: "S", color: "B", value: 49 },
                { square: "G5", type: "C", color: "B", value: 25 },
              ]}
              scale={0.4}
              cropArea={squaresToCropArea("F7", "J4")}
              highlightSquares={["H5", "I5", "H6", "G5"]}
              showLabels={true}
              useNativeAbacusNumbers={useNativeAbacusNumbers}
            />
          </div>

          <div
            className={css({
              bg: "white",
              p: "12px",
              borderRadius: "6px",
              border: "1px solid #fbbf24",
            })}
          >
            <p
              className={css({
                fontSize: "13px",
                fontWeight: "bold",
                color: "#92400e",
                mb: "8px",
              })}
            >
              {t("pieces.pyramidCaptureOptions")}
            </p>
            <ul
              className={css({
                fontSize: "13px",
                color: "#78350f",
                lineHeight: "1.8",
                pl: "20px",
              })}
            >
              <li>{t("pieces.pyramidOption1")}</li>
              <li>{t("pieces.pyramidOption2")}</li>
              <li>{t("pieces.pyramidOption3")}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
