import { useCallback, useState } from "react";

import { type ShareType, getShareUrl } from "@/lib/share/urls";

import { useClipboard } from "./useClipboard";

export interface UseShareCodeOptions {
  /** The type of share (classroom, family, or room) */
  type: ShareType;
  /** The share code */
  code: string;
  /** Optional callback to regenerate the code */
  onRegenerate?: () => Promise<string>;
}

export interface UseShareCodeReturn {
  // Data
  /** The share code */
  code: string;
  /** The full share URL */
  shareUrl: string;

  // Copy actions
  /** Copy the code to clipboard */
  copyCode: () => void;
  /** Whether the code was recently copied */
  codeCopied: boolean;
  /** Copy the share URL to clipboard */
  copyLink: () => void;
  /** Whether the link was recently copied */
  linkCopied: boolean;

  // Regeneration
  /** Regenerate the code (if supported) */
  regenerate: (() => Promise<void>) | undefined;
  /** Whether regeneration is in progress */
  isRegenerating: boolean;
}

/**
 * Hook for managing share code functionality
 *
 * @example
 * ```tsx
 * const share = useShareCode({
 *   type: 'classroom',
 *   code: 'ABC123',
 * })
 *
 * return (
 *   <div>
 *     <button onClick={share.copyCode}>
 *       {share.codeCopied ? 'Copied!' : 'Copy Code'}
 *     </button>
 *     <button onClick={share.copyLink}>
 *       {share.linkCopied ? 'Copied!' : 'Copy Link'}
 *     </button>
 *   </div>
 * )
 * ```
 */
export function useShareCode({
  type,
  code,
  onRegenerate,
}: UseShareCodeOptions): UseShareCodeReturn {
  const shareUrl = getShareUrl(type, code);

  // Separate clipboard state for code and link
  const {
    copied: codeCopied,
    copy: copyCodeToClipboard,
    reset: resetCodeCopied,
  } = useClipboard();
  const {
    copied: linkCopied,
    copy: copyLinkToClipboard,
    reset: resetLinkCopied,
  } = useClipboard();

  const [isRegenerating, setIsRegenerating] = useState(false);

  const copyCode = useCallback(() => {
    // Reset link copied state when copying code
    resetLinkCopied();
    copyCodeToClipboard(code);
  }, [code, copyCodeToClipboard, resetLinkCopied]);

  const copyLink = useCallback(() => {
    // Reset code copied state when copying link
    resetCodeCopied();
    copyLinkToClipboard(shareUrl);
  }, [shareUrl, copyLinkToClipboard, resetCodeCopied]);

  const regenerate = onRegenerate
    ? async () => {
        setIsRegenerating(true);
        try {
          await onRegenerate();
        } finally {
          setIsRegenerating(false);
        }
      }
    : undefined;

  return {
    code,
    shareUrl,
    copyCode,
    codeCopied,
    copyLink,
    linkCopied,
    regenerate,
    isRegenerating,
  };
}
