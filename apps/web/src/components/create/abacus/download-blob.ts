'use client'

// The studio's one "save this file" idiom: an anchored object URL, clicked and
// revoked. Factored out of FabricationRail when ModularSeamPanel became the
// second consumer — never fork, always factor.

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
