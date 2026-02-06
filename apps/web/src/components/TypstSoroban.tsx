/**
 * TypstSoroban - Stub component
 *
 * This is a placeholder for the Typst-based soroban renderer.
 * TODO: Implement actual Typst rendering or replace with AbacusStatic.
 */

interface TypstSorobanProps {
  number: number
  width?: string
  height?: string
  className?: string
}

export function TypstSoroban({ number, width, height, className }: TypstSorobanProps) {
  return (
    <div
      data-component="typst-soroban"
      className={className}
      style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {number}
    </div>
  )
}
