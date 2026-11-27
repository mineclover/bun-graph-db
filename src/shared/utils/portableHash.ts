const textEncoder = new TextEncoder()

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

const SHA256_INIT = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
])

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const BASE64_LOOKUP = (() => {
  const table = new Int16Array(256).fill(-1)
  for (let i = 0; i < BASE64_ALPHABET.length; i += 1) {
    table[BASE64_ALPHABET.charCodeAt(i)] = i
  }
  return table
})()

function toUint8Array(input: Uint8Array | string): Uint8Array {
  return typeof input === 'string' ? textEncoder.encode(input) : input
}

function rotr(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift))
}

/**
 * Pure TypeScript FIPS 180-4 SHA-256 implementation requiring zero Node built-ins or WebCrypto globals.
 */
export function sha256Bytes(input: Uint8Array | string): Uint8Array {
  const bytes = toUint8Array(input)
  const bitLen = BigInt(bytes.length) * 8n
  const remainder = (bytes.length + 9) % 64
  const padZeroBytes = remainder === 0 ? 0 : 64 - remainder
  const padded = new Uint8Array(bytes.length + 1 + padZeroBytes + 8)
  padded.set(bytes, 0)
  padded[bytes.length] = 0x80

  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength)
  view.setBigUint64(padded.length - 8, bitLen, false)

  const state = new Uint32Array(SHA256_INIT)
  const w = new Uint32Array(64)

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false)
    }
    for (let i = 16; i < 64; i += 1) {
      const w15 = w[i - 15] as number
      const w2 = w[i - 2] as number
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3)
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10)
      w[i] = ((w[i - 16] as number) + s0 + (w[i - 7] as number) + s1) >>> 0
    }

    let a = state[0] as number
    let b = state[1] as number
    let c = state[2] as number
    let d = state[3] as number
    let e = state[4] as number
    let f = state[5] as number
    let g = state[6] as number
    let h = state[7] as number

    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + s1 + ch + (SHA256_K[i] as number) + (w[i] as number)) >>> 0
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + maj) >>> 0

      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    state[0] = ((state[0] as number) + a) >>> 0
    state[1] = ((state[1] as number) + b) >>> 0
    state[2] = ((state[2] as number) + c) >>> 0
    state[3] = ((state[3] as number) + d) >>> 0
    state[4] = ((state[4] as number) + e) >>> 0
    state[5] = ((state[5] as number) + f) >>> 0
    state[6] = ((state[6] as number) + g) >>> 0
    state[7] = ((state[7] as number) + h) >>> 0
  }

  const out = new Uint8Array(32)
  const outView = new DataView(out.buffer)
  for (let i = 0; i < 8; i += 1) {
    outView.setUint32(i * 4, state[i] as number, false)
  }
  return out
}

export function sha256Hex(input: Uint8Array | string): string {
  const digest = sha256Bytes(input)
  let hex = ''
  for (let i = 0; i < digest.length; i += 1) {
    hex += (digest[i] as number).toString(16).padStart(2, '0')
  }
  return hex
}

export function encodeBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] as number
    const hasB1 = i + 1 < bytes.length
    const hasB2 = i + 2 < bytes.length
    const b1 = hasB1 ? (bytes[i + 1] as number) : 0
    const b2 = hasB2 ? (bytes[i + 2] as number) : 0
    const triplet = (b0 << 16) | (b1 << 8) | b2
    out += BASE64_ALPHABET[(triplet >> 18) & 0x3f]
    out += BASE64_ALPHABET[(triplet >> 12) & 0x3f]
    out += hasB1 ? BASE64_ALPHABET[(triplet >> 6) & 0x3f] : '='
    out += hasB2 ? BASE64_ALPHABET[triplet & 0x3f] : '='
  }
  return out
}

export function decodeBase64(base64: string): Uint8Array {
  const normalized = base64.replace(/\s+/g, '')
  if (normalized.length === 0) {
    return new Uint8Array(0)
  }
  if (normalized.length % 4 !== 0) {
    throw new Error('Invalid base64 string length')
  }
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
  const outputLength = (normalized.length / 4) * 3 - padding
  const out = new Uint8Array(outputLength)
  let outIndex = 0

  for (let i = 0; i < normalized.length; i += 4) {
    const c0 = BASE64_LOOKUP[normalized.charCodeAt(i)] ?? -1
    const c1 = BASE64_LOOKUP[normalized.charCodeAt(i + 1)] ?? -1
    const c2Char = normalized[i + 2]
    const c3Char = normalized[i + 3]
    const c2 = c2Char === '=' ? 0 : (BASE64_LOOKUP[normalized.charCodeAt(i + 2)] ?? -1)
    const c3 = c3Char === '=' ? 0 : (BASE64_LOOKUP[normalized.charCodeAt(i + 3)] ?? -1)
    if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) {
      throw new Error('Invalid character in base64 string')
    }
    const triplet = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3
    if (outIndex < outputLength) out[outIndex++] = (triplet >> 16) & 0xff
    if (outIndex < outputLength) out[outIndex++] = (triplet >> 8) & 0xff
    if (outIndex < outputLength) out[outIndex++] = triplet & 0xff
  }
  return out
}

export function sha256Base64Url(input: Uint8Array | string): string {
  return encodeBase64(sha256Bytes(input))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

/**
 * Constant-time equality comparison safe across Node, Cloudflare Workers, and Browsers.
 */
export function constantTimeEqual(left: string | Uint8Array, right: string | Uint8Array): boolean {
  const leftBytes = toUint8Array(left)
  const rightBytes = toUint8Array(right)
  if (leftBytes.length !== rightBytes.length) {
    return false
  }
  let diff = 0
  for (let i = 0; i < leftBytes.length; i += 1) {
    diff |= (leftBytes[i] as number) ^ (rightBytes[i] as number)
  }
  return diff === 0
}
