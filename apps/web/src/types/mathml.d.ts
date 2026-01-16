/**
 * MathML JSX type declarations for React
 * Browser support: 94%+ (Chrome 109+, Firefox, Safari 10+, Edge 109+)
 */

import * as React from 'react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      // MathML root element
      math: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement>

      // MathML token elements
      mi: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // identifier
      mn: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // number
      mo: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // operator
      ms: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // string literal
      mtext: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // text

      // MathML layout elements
      mrow: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // group
      mfrac: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // fraction
      msqrt: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // square root
      mroot: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // nth root
      msup: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // superscript
      msub: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // subscript
      msubsup: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // sub+superscript
      munder: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // underscript
      mover: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // overscript
      munderover: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // under+overscript
      mtable: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // table
      mtr: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // table row
      mtd: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // table cell
      mfenced: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // fenced (parentheses)
      mspace: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // space
      mpadded: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // padded
      mphantom: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // phantom (invisible)
      menclose: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement> // enclose

      // MathML semantic elements
      semantics: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement>
      annotation: React.DetailedHTMLProps<React.HTMLAttributes<MathMLElement>, MathMLElement>
    }
  }
}
