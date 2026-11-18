/**
 * Lets tests read the official source files as text with Vite's "?raw" import
 * (for example data/sources/uscis-2025-civics-128.txt?raw).
 */
declare module "*?raw" {
  const content: string;
  export default content;
}
