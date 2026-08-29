const JSDOMEnvironment = require('jest-environment-jsdom').default;

/**
 * jsdom builds its own JS realm, so `global.Uint8Array` inside a test is a
 * *different* constructor from the one Node's `Buffer` extends. esbuild (pulled
 * in by jest-preset-angular) asserts `Buffer.from('') instanceof Uint8Array` on
 * load and throws "your JavaScript environment is broken" when that's false.
 *
 * Handing the jsdom global the Node realm's binary constructors makes the
 * instanceof checks line up again. TextEncoder/TextDecoder are absent from
 * jsdom entirely and several Angular/zone paths expect them.
 */
class CheetahJSDOMEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context);

    const { TextEncoder, TextDecoder } = require('util');

    Object.assign(this.global, {
      ArrayBuffer,
      Uint8Array,
      Uint8ClampedArray,
      Uint16Array,
      Uint32Array,
      Int8Array,
      Int16Array,
      Int32Array,
      Float32Array,
      Float64Array,
      BigInt64Array,
      BigUint64Array,
      DataView,
      Buffer,
      TextEncoder,
      TextDecoder,
    });

    if (typeof this.global.structuredClone !== 'function') {
      this.global.structuredClone = structuredClone;
    }
  }
}

module.exports = CheetahJSDOMEnvironment;
