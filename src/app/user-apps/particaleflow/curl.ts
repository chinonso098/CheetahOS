
import { Noise } from "./noise";

export function getCurl (x: number, y: number, z: any) {
  const delta = 0.01;
  let n1 = Noise.perlin(x + delta, y, z);
  let n2 = Noise.perlin(x - delta, y, z);
  const cy = -(n1 - n2) / (delta * 2);

  n1 = Noise.perlin(x, y + delta, z);
  n2 = Noise.perlin(x, y - delta, z);
  const cx = (n1 - n2) / (delta * 2);
  return { x: cx, y: cy };
}
