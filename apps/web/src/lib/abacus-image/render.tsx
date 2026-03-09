import React from 'react'
import { AbacusStatic } from '@soroban/abacus-react/static'
import type { AbacusStaticConfig } from '@soroban/abacus-react/static'

// Isolated in its own file so Next.js SWC doesn't block react-dom/server
// import in the API route (app router blocks static imports of react-dom/server)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToStaticMarkup } = require('react-dom/server') as typeof import('react-dom/server')

export function renderAbacusSvg(config: AbacusStaticConfig): string {
  return renderToStaticMarkup(React.createElement(AbacusStatic, config))
}
