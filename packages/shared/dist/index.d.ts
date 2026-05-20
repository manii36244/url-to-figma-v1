export type IRDropShadow = {
    color: string;
    offsetX: number;
    offsetY: number;
    blur: number;
    spread: number;
};
export type IRGradientStop = {
    color: string;
    position: number;
};
export type IRLinearGradient = {
    type: 'linear-gradient';
    angle: number;
    stops: IRGradientStop[];
};
export type IRRadialGradient = {
    type: 'radial-gradient';
    stops: IRGradientStop[];
};
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
    cornerRadii?: [number, number, number, number];
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
    backgroundSrc?: string;
    stroke?: string;
    strokeWidth?: number;
    borderRadius?: number;
    cornerRadii?: [number, number, number, number];
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
export type IRNode = IRFrameNode | IRTextNode | IRRectNode | IRVectorNode | IRImageNode;
export type IRDocument = {
    version: string;
    sourceUrl?: string;
    pageWidth: number;
    pageHeight: number;
    nodes: IRNode[];
};
//# sourceMappingURL=index.d.ts.map