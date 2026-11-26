// Types for tools/images/flag.mjs (used by the tests).
export declare const FLAG: { A: number; B: number; C: number; D: number; E: number; F: number; G: number; H: number; K: number; L: number };
export declare const FLAG_RED: string;
export declare const FLAG_BLUE: string;
export declare function flagShapes(): {
  stripes: { y: number; height: number; color: "red" | "white" }[];
  stars: { x: number; y: number; row: number; col: number }[];
  union: { width: number; height: number };
};
export declare function flagSvg(height?: number): string;
