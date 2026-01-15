import type { ComponentProps } from "react";
import { QRCodeSVG } from "qrcode.react";

type QRCodeSVGProps = ComponentProps<typeof QRCodeSVG>;

export interface AbacusQRCodeProps
  extends Omit<QRCodeSVGProps, "imageSettings"> {
  /**
   * Override the default abacus logo with a custom image
   * If not provided, uses the abacus icon at /icon (only on QR codes >= 150px)
   */
  imageSettings?: QRCodeSVGProps["imageSettings"];

  /**
   * Minimum size (in pixels) to show the logo
   * Below this threshold, QR code will be plain for better scannability
   * @default 150
   */
  minLogoSize?: number;
}

/**
 * QR Code component with the abacus logo in the middle
 *
 * This is a thin wrapper around QRCodeSVG that adds our branding by default.
 * Use this as the standard QR code component throughout the app.
 *
 * **Smart logo sizing:** The abacus logo only appears on QR codes >= 150px.
 * Smaller QR codes show plain dots for better scannability.
 *
 * @example
 * ```tsx
 * // Large QR code - shows abacus logo
 * <AbacusQRCode
 *   value="https://abaci.one/share/abc123"
 *   size={200}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Small QR code - no logo (too small)
 * <AbacusQRCode
 *   value="https://abaci.one/room/xyz"
 *   size={84}
 * />
 * ```
 *
 * @example With custom styling
 * ```tsx
 * <AbacusQRCode
 *   value="https://abaci.one/room/xyz"
 *   size={300}
 *   fgColor="#1a1a2e"
 *   level="H"  // High error correction for better scanning with logo
 * />
 * ```
 */
export function AbacusQRCode({
  imageSettings,
  minLogoSize = 150,
  size = 128,
  level = "H", // Default to high error correction for logo
  fgColor = "#111827",
  bgColor = "#ffffff",
  ...props
}: AbacusQRCodeProps) {
  // Only show logo on QR codes large enough for it to scan reliably
  const showLogo = typeof size === "number" && size >= minLogoSize;

  // Calculate logo size as 22% of QR code size (scales nicely)
  const logoSize = typeof size === "number" ? Math.round(size * 0.22) : 48;

  return (
    <QRCodeSVG
      {...props}
      size={size}
      level={level}
      fgColor={fgColor}
      bgColor={bgColor}
      imageSettings={
        showLogo
          ? (imageSettings ?? {
              src: "/icon",
              height: logoSize,
              width: logoSize,
              excavate: true, // Clear space behind logo for better scanning
            })
          : undefined // No logo on small QR codes
      }
    />
  );
}
