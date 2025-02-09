/* eslint-disable @typescript-eslint/no-namespace */

export namespace Colors{

  export function changeHue(hexColor:string, degree:number) {
    // Ensure the input is a valid hexadecimal color
    const hexRegex = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
    if (!hexRegex.test(hexColor)) {
      console.error('Invalid hexadecimal color code');
      return null;
    }
  
    // Remove the hash character (#) and convert to RGB
    const rgbColor = hexColor.substring(1);
    const bigint = parseInt(rgbColor, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
  
    // Convert RGB to HSL
    const hslColor = rgbToHsl(r, g, b);
  
    // Shift the hue
    hslColor.h += degree;
  
    // Ensure hue is within the valid range [0, 360)
    hslColor.h = (hslColor.h + 360) % 360;
  
    // Convert HSL back to RGB
    const finalRgbColor = hslToRgb(hslColor.h, hslColor.s, hslColor.l);
  
    // Convert RGB back to hexadecimal
    const finalHexColor = rgbToHex_(finalRgbColor.r, finalRgbColor.g, finalRgbColor.b);
  
    return `#${finalHexColor}`;
  }
  
  // Convert RGB to HSL
  export function rgbToHsl(r:number, g:number, b:number) {
    r /= 255;
    g /= 255;
    b /= 255;
  
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    // eslint-disable-next-line prefer-const
    let h, s, l = (max + min) / 2;
  
    if (max === min) {
      h = s = 0; // grayscale
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }

      if(h)
        h /= 6;
    }
  
    return { h: h || 1 * 360, s: s * 100, l: l * 100 };
  }
  
  // Convert HSL to RGB
  export function hslToRgb(h:number, s:number, l:number) {
    h /= 360;
    s /= 100;
    l /= 100;
  
    let r, g, b;
  
    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p:number, q:number, t:number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
  
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
  
    return { r: r * 255, g: g * 255, b: b * 255 };
  }
  
  // Convert RGB to Hex
  export function rgbToHex_(r:number, g:number, b:number) {
    const toHex = (value:number) => {
      const hex = Math.round(value).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
  
    return toHex(r) + toHex(g) + toHex(b);
  }  


  /** Interpolates between two hex colors */
  export function interpolateHexColor(start: number, end: number, progress: number): number {
    const startRGB = hexToRgb(start);
    const endRGB = hexToRgb(end);

    const interpolatedRGB = startRGB.map((startVal, i) =>
      Math.round(startVal + (endRGB[i] - startVal) * progress)
    );

    return rgbToHex(interpolatedRGB);
  }

  /** Converts hex color to RGB array */
  export function hexToRgb(hex: number): number[] {
    return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  }

  /** Converts RGB array to hex number */
  export function rgbToHex(rgb: number[]): number {
    return (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
  }

}