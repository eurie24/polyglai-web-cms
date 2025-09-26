declare module 'pdfjs-dist/build/pdf.mjs' {
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(params: unknown): { promise: Promise<unknown> };
}

declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(params: unknown): { promise: Promise<unknown> };
}

declare module 'pdfjs-dist/legacy/build/pdf' {
  const mod: unknown;
  export default mod;
}


