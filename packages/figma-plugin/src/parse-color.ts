export type RGBA = { r: number; g: number; b: number; a: number };

export function parseColor(css: string): RGBA | null {
  if (!css || css === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  const rgb = css.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (rgb) {
    return {
      r: Math.min(parseFloat(rgb[1]) / 255, 1),
      g: Math.min(parseFloat(rgb[2]) / 255, 1),
      b: Math.min(parseFloat(rgb[3]) / 255, 1),
      a: rgb[4] !== undefined ? parseFloat(rgb[4]) : 1,
    };
  }

  const hex = css.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16) / 255,
        g: parseInt(hex[1] + hex[1], 16) / 255,
        b: parseInt(hex[2] + hex[2], 16) / 255,
        a: 1,
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
        a: 1,
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
  }

  return null;
}
