import { Num } from "./num";

/*
 * Ported pretty directly from https://github.com/josephg/noisejs
 * Just some minor structural tweaks and a few convenience methods added.
 * Original attribution below.
 */

/*
 * A speed-improved perlin and simplex noise algorithms for 2D.
 *
 * Based on example code by Stefan Gustavson (stegu@itn.liu.se).
 * Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
 * Better rank ordering method by Stefan Gustavson in 2012.
 * Converted to Javascript by Joseph Gentle.
 *
 * Version 2012-03-09
 *
 * This code was placed in the public domain by its original author,
 * Stefan Gustavson. You may use it as you see fit, but
 * attribution is appreciated.
 *
 */


class Grad {
    x !: number;
    y !: number;
    z !: number;

  constructor(x: number, y: number, z: number) {
    this.x = x; this.y = y; this.z = z;
  }

  dot2(x: number, y: number) {
    return this.x * x + this.y * y;
  }

  dot3(x: number, y: number, z: number) {
    return this.x * x + this.y * y + this.z * z;
  }
}
export const Noise = {
  grad3: [new Grad(1, 1, 0), new Grad(-1, 1, 0), new Grad(1, -1, 0), new Grad(-1, -1, 0),
    new Grad(1, 0, 1), new Grad(-1, 0, 1), new Grad(1, 0, -1), new Grad(-1, 0, -1),
    new Grad(0, 1, 1), new Grad(0, -1, 1), new Grad(0, 1, -1), new Grad(0, -1, -1)],

  p: [151, 160, 137, 91, 90, 15,
    131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23,
    190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33,
    88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166,
    77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244,
    102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196,
    135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123,
    5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42,
    223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
    129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228,
    251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107,
    49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254,
    138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180],

  // To remove the need for index wrapping, double the permutation table length
  perm: new Array(512),
  gradP: new Array(512),

  // This isn't a very good seeding function, but it works ok. It supports 2^16
  // different seed values. Write something better if you need more seeds.
  seed: function(seed: number) {
    if (seed > 0 && seed < 1) {
      // Scale the seed out
      seed *= 65536;
    }

    seed = Math.floor(seed);
    if (seed < 256) {
      seed |= seed << 8;
    }

    for (let i = 0; i < 256; i++) {
      let v;
      if (i & 1) {
        v = Noise.p[i] ^ (seed & 255);
      } else {
        v = Noise.p[i] ^ ((seed >> 8) & 255);
      }

      Noise.perm[i] = Noise.perm[i + 256] = v;
      Noise.gradP[i] = Noise.gradP[i + 256] = Noise.grad3[v % 12];
    }
  },

  simplex1: function(xin: any) {
    return Noise.simplex2(xin, 0);
  },

  simplex1Range: function(xin: number, scale: number, min: any, max: any) {
    return Num.map(Noise.simplex1(xin * scale), -1, 1, min, max);
  },

  // 2D simplex noise
  simplex2: function(xin: number, yin: number) {
    const gradP = Noise.gradP;
    const perm = Noise.perm;
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    let n0, n1, n2; // Noise contributions from the three corners
    // Skew the input space to determine which simplex cell we're in
    const s = (xin + yin) * F2; // Hairy factor for 2D
    let i = Math.floor(xin + s);
    let j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - i + t; // The x,y distances from the cell origin, unskewed.
    const y0 = yin - j + t;
    // For the 2D case, the simplex shape is an equilateral triangle.
    // Determine which simplex we are in.
    let i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
    if (x0 > y0) { // lower triangle, XY order: (0,0)->(1,0)->(1,1)
      i1 = 1; j1 = 0;
    } else { // upper triangle, YX order: (0,0)->(0,1)->(1,1)
      i1 = 0; j1 = 1;
    }
    // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
    // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
    // c = (3-sqrt(3))/6
    const x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2; // Offsets for last corner in (x,y) unskewed coords
    const y2 = y0 - 1 + 2 * G2;
    // Work out the hashed gradient indices of the three simplex corners
    i &= 255;
    j &= 255;
    const gi0 = gradP[i + perm[j]];
    const gi1 = gradP[i + i1 + perm[j + j1]];
    const gi2 = gradP[i + 1 + perm[j + 1]];
    // Calculate the contribution from the three corners
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) {
      n0 = 0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * gi0.dot2(x0, y0); // (x,y) of grad3 used for 2D gradient
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) {
      n1 = 0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * gi1.dot2(x1, y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) {
      n2 = 0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * gi2.dot2(x2, y2);
    }
    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 70 * (n0 + n1 + n2);
  },

  simplex2Range: function(xin: number, yin: number, scale: number, min: any, max: any) {
    return Num.map(Noise.simplex2(xin * scale, yin * scale), -1, 1, min, max);
  },

  // 3D simplex noise
  simplex3: function(xin: number, yin: number, zin: number) {
    const gradP = Noise.gradP;
    const perm = Noise.perm;
    const F3 = 1 / 3;
    const G3 = 1 / 6;
    let n0, n1, n2, n3; // Noise contributions from the four corners

    // Skew the input space to determine which simplex cell we're in
    const s = (xin + yin + zin) * F3; // Hairy factor for 2D
    let i = Math.floor(xin + s);
    let j = Math.floor(yin + s);
    let k = Math.floor(zin + s);

    const t = (i + j + k) * G3;
    const x0 = xin - i + t; // The x,y distances from the cell origin, unskewed.
    const y0 = yin - j + t;
    const z0 = zin - k + t;

    // For the 3D case, the simplex shape is a slightly irregular tetrahedron.
    // Determine which simplex we are in.
    let i1, j1, k1; // Offsets for second corner of simplex in (i,j,k) coords
    let i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    // A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z),
    // a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z), and
    // a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z), where
    // c = 1/6.
    const x1 = x0 - i1 + G3; // Offsets for second corner
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;

    const x2 = x0 - i2 + 2 * G3; // Offsets for third corner
    const y2 = y0 - j2 + 2 * G3;
    const z2 = z0 - k2 + 2 * G3;

    const x3 = x0 - 1 + 3 * G3; // Offsets for fourth corner
    const y3 = y0 - 1 + 3 * G3;
    const z3 = z0 - 1 + 3 * G3;

    // Work out the hashed gradient indices of the four simplex corners
    i &= 255;
    j &= 255;
    k &= 255;
    const gi0 = gradP[i + perm[j + perm[k ]]];
    const gi1 = gradP[i + i1 + perm[j + j1 + perm[k + k1]]];
    const gi2 = gradP[i + i2 + perm[j + j2 + perm[k + k2]]];
    const gi3 = gradP[i + 1 + perm[j + 1 + perm[k + 1]]];

    // Calculate the contribution from the four corners
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 < 0) {
      n0 = 0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * gi0.dot3(x0, y0, z0); // (x,y) of grad3 used for 2D gradient
    }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 < 0) {
      n1 = 0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * gi1.dot3(x1, y1, z1);
    }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 < 0) {
      n2 = 0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * gi2.dot3(x2, y2, z2);
    }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 < 0) {
      n3 = 0;
    } else {
      t3 *= t3;
      n3 = t3 * t3 * gi3.dot3(x3, y3, z3);
    }
    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 32 * (n0 + n1 + n2 + n3);
  },

  simplex3Range: function(xin: number, yin: number, zin: any, scale: number, min: any, max: any) {
    return Num.map(Noise.simplex3(xin * scale, yin * scale, zin), -1, 1, min, max);
  },

  simplex: function(xin: any, yin: any, zin: any) {
    return Noise.simplex3(xin, yin, zin);
  },

  simplexRange: function(xin: any, yin: any, zin: any, scale: any, min: any, max: any) {
    return Noise.simplex3Range(xin, yin, zin, scale, min, max);
  },

  // ##### Perlin noise stuff

  fade: function(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  },

  lerp: function(a: number, b: number, t: number) {
    return (1 - t) * a + t * b;
  },

  perlin1: function(x: any) {
    return Noise.perlin2(x, 0);
  },

  perlin1Range: function(x: number, scale: number, min: any, max: any) {
    return Num.map(Noise.perlin1(x * scale), -1, 1, min, max);
  },

  // 2D Perlin Noise
  perlin2: function(x: number, y: number) {
    const gradP = Noise.gradP;
    const perm = Noise.perm;
    // Find unit grid cell containing point
    let X = Math.floor(x), Y = Math.floor(y);
    // Get relative xy coordinates of point within that cell
    x = x - X; y = y - Y;
    // Wrap the integer cells at 255 (smaller integer period can be introduced here)
    X = X & 255; Y = Y & 255;

    // Calculate noise contributions from each of the four corners
    const n00 = gradP[X + perm[Y]].dot2(x, y);
    const n01 = gradP[X + perm[Y + 1]].dot2(x, y - 1);
    const n10 = gradP[X + 1 + perm[Y]].dot2(x - 1, y);
    const n11 = gradP[X + 1 + perm[Y + 1]].dot2(x - 1, y - 1);

    // Compute the fade curve value for x
    const u = Noise.fade(x);

    // Interpolate the four results
    return Noise.lerp(
      Noise.lerp(n00, n10, u),
      Noise.lerp(n01, n11, u),
      Noise.fade(y));
  },

  perlin2Range: function(x: number, y: number, scale: number, min: any, max: any) {
    return Num.map(Noise.perlin2(x * scale, y * scale), -1, 1, min, max);
  },

  // 3D Perlin Noise
  perlin3: function(x: number, y: number, z: number) {
    const perm = Noise.perm;
    const gradP = Noise.gradP;
    // Find unit grid cell containing point
    let X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    // Get relative xyz coordinates of point within that cell
    x = x - X; y = y - Y; z = z - Z;
    // Wrap the integer cells at 255 (smaller integer period can be introduced here)
    X = X & 255; Y = Y & 255; Z = Z & 255;

    // Calculate noise contributions from each of the eight corners
    const n000 = gradP[X + perm[Y + perm[Z ]]].dot3(x, y, z);
    const n001 = gradP[X + perm[Y + perm[Z + 1]]].dot3(x, y, z - 1);
    const n010 = gradP[X + perm[Y + 1 + perm[Z ]]].dot3(x, y - 1, z);
    const n011 = gradP[X + perm[Y + 1 + perm[Z + 1]]].dot3(x, y - 1, z - 1);
    const n100 = gradP[X + 1 + perm[Y + perm[Z ]]].dot3(x - 1, y, z);
    const n101 = gradP[X + 1 + perm[Y + perm[Z + 1]]].dot3(x - 1, y, z - 1);
    const n110 = gradP[X + 1 + perm[Y + 1 + perm[Z ]]].dot3(x - 1, y - 1, z);
    const n111 = gradP[X + 1 + perm[Y + 1 + perm[Z + 1]]].dot3(x - 1, y - 1, z - 1);

    // Compute the fade curve value for x, y, z
    const u = Noise.fade(x);
    const v = Noise.fade(y);
    const w = Noise.fade(z);

    // Interpolate
    return Noise.lerp(
      Noise.lerp(
        Noise.lerp(n000, n100, u),
        Noise.lerp(n001, n101, u), w),
      Noise.lerp(
        Noise.lerp(n010, n110, u),
        Noise.lerp(n011, n111, u), w),
      v);
  },

  perlin3Range: function(x: number, y: number, z: number, scale: number, min: any, max: any) {
    return Num.map(Noise.perlin3(x * scale, y * scale, z * scale), -1, 1, min, max);
  },

  perlin: function(x: any, y: any, z: any) {
    return Noise.perlin3(x, y, z);
  },

  perlinRange: function(x: number, y: number, z: number, scale: number, min: any, max: any) {
    return Num.map(Noise.perlin3(x * scale, y * scale, z * scale), -1, 1, min, max);
  },

};

Noise.seed(0);