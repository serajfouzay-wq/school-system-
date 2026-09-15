/// <reference types="vite/client" />

/** Fonts imported with `?inline` come back as base64 data URLs, which is how
 *  printed documents carry Arabic shaping into a standalone print window. */
declare module '*.woff2?inline' {
  const src: string
  export default src
}

declare module '*.woff2' {
  const src: string
  export default src
}

declare module '*.sql?raw' {
  const content: string
  export default content
}
