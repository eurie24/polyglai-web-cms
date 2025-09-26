declare module 'pdfjs-dist/build/pdf.mjs' {
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(params: any): { promise: Promise<any> };
}

declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(params: any): { promise: Promise<any> };
}

declare module 'pdfjs-dist/legacy/build/pdf' {
  const mod: any;
  export default mod;
}


