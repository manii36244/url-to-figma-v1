export type CaptureOptions = {
    url: string;
    outputPath: string;
    viewportWidth?: number;
    viewportHeight?: number;
};
export type StyleName = 'display' | 'position' | 'color' | 'backgroundColor' | 'backgroundImage' | 'fontFamily' | 'fontSize' | 'fontWeight' | 'lineHeight' | 'letterSpacing' | 'textAlign' | 'borderRadius' | 'borderWidth' | 'borderColor' | 'borderStyle' | 'boxShadow' | 'opacity' | 'zIndex' | 'borderTopLeftRadius' | 'borderTopRightRadius' | 'borderBottomRightRadius' | 'borderBottomLeftRadius' | 'fontStyle' | 'textDecorationLine' | 'overflow' | 'objectFit';
export type RawElement = {
    tag: string;
    text?: string;
    src?: string;
    rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    styles: Record<StyleName, string>;
};
export type RawAsset = {
    url: string;
    type: 'image' | 'font';
    localPath: string;
    mimeType: string;
};
export type RawCapture = {
    url: string;
    viewport: {
        width: number;
        height: number;
    };
    elements: RawElement[];
    assets: RawAsset[];
    pageBackground?: string;
};
export declare function capture(options: CaptureOptions): Promise<RawCapture>;
//# sourceMappingURL=index.d.ts.map