/// <reference types="vite/client" />

declare module '*.glb?b64' {
  const base64: string;
  export default base64;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.mp3' {
  const src: string;
  export default src;
}
