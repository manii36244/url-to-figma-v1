export type IRDropShadow = {
  color: string;    // CSS rgba/rgb string
  offsetX: number;  // px
  offsetY: number;  // px
  blur: number;     // px
  spread: number;   // px
};

export type IRGradientStop = {
  color: string;    // CSS color string (rgb/rgba/hex)
  position: number; // 0.0 – 1.0
};

export type IRLinearGradient = {
  type: 'linear-gradient';
  angle: number;   // CSS angle in degrees (0=to top, 90=to right, 180=to bottom)
  stops: IRGradientStop[];
};

export type IRRadialGradient = {
  type: 'radial-gradient';
  stops: IRGradientStop[];
};

// A fill is either a flat CSS color string or a gradient descriptor
export type IRFill = string | IRLinearGradient | IRRadialGradient;

export type IRNodeBase = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  effects?: IRDropShadow[];
};

export type IRFrameNode = IRNodeBase & {
  type: 'frame';
  children: IRNode[];
  fill?: IRFill;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  cornerRadii?: [number, number, number, number]; // TL, TR, BR, BL
  opacity?: number;
  clipContent?: boolean;
};

export type IRTextNode = IRNodeBase & {
  type: 'text';
  content: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  color?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
  textDecoration?: 'none' | 'underline' | 'line-through';
  textShadow?: IRDropShadow[];
};

export type IRRectNode = IRNodeBase & {
  type: 'rect';
  fill?: IRFill;
  backgroundSrc?: string; // URL for CSS background-image: url(…)
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  cornerRadii?: [number, number, number, number]; // TL, TR, BR, BL
  opacity?: number;
};

export type IRVectorNode = IRNodeBase & {
  type: 'vector';
  pathData?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
};

export type IRImageNode = IRNodeBase & {
  type: 'image';
  src: string;
  alt?: string;
  objectFit?: 'fill' | 'contain' | 'cover' | 'none' | 'scale-down';
};

export type IRNode =
  | IRFrameNode
  | IRTextNode
  | IRRectNode
  | IRVectorNode
  | IRImageNode;

export type IRDocument = {
  version: string;
  sourceUrl?: string;
  pageWidth: number;
  pageHeight: number;
  nodes: IRNode[];
};
