declare module 'canvas' {
  interface Canvas extends HTMLCanvasElement {
    toBuffer(mimeType: string): Buffer
  }
  export function createCanvas(width: number, height: number): Canvas
}
