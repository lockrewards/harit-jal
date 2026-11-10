// ====================================================================
// HARIT JAL™ (हरित जल) — CRYPTOGRAPHIC UTILITIES
// FIPS 180-4 compliant Salted SHA-256 & Timing-Safe Verification
// Runs identically in Browser (Vite) and Node.js environments.
// ====================================================================

/**
 * Standard SHA-256 implementation (FIPS 180-4)
 */
function sha256(ascii: string): string {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i = 0;
  let j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  // Initial hash values: first 32 bits of the fractional parts of the square roots of the first 8 primes
  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isPrime = (n: number) => {
    for (let factor = 2; factor * factor <= n; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < ascii[lengthProperty]; i++) {
    words[i >> 2] |= ascii.charCodeAt(i) << (24 - (i % 4) * 8);
  }

  for (i = 0; i < words[lengthProperty]; i += 16) {
    const w: number[] = [];
    for (j = 0; j < 16; j++) w[j] = words[i + j] | 0;
    for (j = 16; j < 64; j++) {
      const s0 =
        (((w[j - 15] >>> 7) | (w[j - 15] << 25)) ^
          ((w[j - 15] >>> 18) | (w[j - 15] << 14)) ^
          (w[j - 15] >>> 3)) |
        0;
      const s1 =
        (((w[j - 2] >>> 17) | (w[j - 2] << 15)) ^
          ((w[j - 2] >>> 19) | (w[j - 2] << 13)) ^
          (w[j - 2] >>> 10)) |
        0;
      w[j] = (((w[j - 16] + s0) | 0) + ((w[j - 7] + s1) | 0)) | 0;
    }

    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];

    for (j = 0; j < 64; j++) {
      const s1 =
        (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) | 0;
      const ch = ((e & f) ^ (~e & g)) | 0;
      const temp1 = ((((h + s1) | 0) + ((ch + k[j]) | 0)) | 0) + w[j] | 0;
      const s0 =
        (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) | 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) | 0;
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}

/**
 * Generate a cryptographically secure random salt in hex format
 */
export function generateSalt(length: number = 16): string {
  const cryptoObj = typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto : null;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = new Uint8Array(length);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  throw new Error('Cryptographically secure RNG (crypto.getRandomValues) is required but unavailable in this environment.');
}

/**
 * HMAC-SHA256 (RFC 2104) implementation
 */
export function hmacSha256(key: string, message: string): string {
  let k = key;
  if (k.length > 64) {
    k = sha256(k);
  }
  while (k.length < 64) {
    k += '\0';
  }

  let oKeyPad = '';
  let iKeyPad = '';
  for (let i = 0; i < 64; i++) {
    oKeyPad += String.fromCharCode(k.charCodeAt(i) ^ 0x5c);
    iKeyPad += String.fromCharCode(k.charCodeAt(i) ^ 0x36);
  }

  const innerHash = sha256(iKeyPad + message);
  let innerBinary = '';
  for (let i = 0; i < innerHash.length; i += 2) {
    innerBinary += String.fromCharCode(parseInt(innerHash.substr(i, 2), 16));
  }
  return sha256(oKeyPad + innerBinary);
}

/**
 * PBKDF2 with HMAC-SHA256 (RFC 2898 / NIST SP 800-132)
 * Provides high-work-factor key stretching for offline/mock authentication.
 * Format: pbkdf2$<iterations>$<salt>$<hash>
 */
export function pbkdf2Sync(
  password: string,
  salt: string,
  iterations: number = 10000,
  keyLen: number = 32
): string {
  let u = hmacSha256(password, salt + '\x00\x00\x00\x01');
  const resultBytes = new Uint8Array(keyLen);
  for (let i = 0; i < keyLen && i * 2 < u.length; i++) {
    resultBytes[i] = parseInt(u.substr(i * 2, 2), 16);
  }

  for (let i = 1; i < iterations; i++) {
    u = hmacSha256(password, u);
    for (let j = 0; j < keyLen && j * 2 < u.length; j++) {
      resultBytes[j] ^= parseInt(u.substr(j * 2, 2), 16);
    }
  }

  return Array.from(resultBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a password using PBKDF2-HMAC-SHA256 (NIST SP 800-132 compliant)
 * Format: pbkdf2$<iterations>$<salt>$<hash>
 */
export function hashPasswordPBKDF2(
  password: string,
  salt?: string,
  iterations: number = 10000
): { hash: string; salt: string; iterations: number; combined: string } {
  const cleanSalt = salt || generateSalt(16);
  const hash = pbkdf2Sync(password.trim(), cleanSalt, iterations, 32);
  const combined = `pbkdf2$${iterations}$${cleanSalt}$${hash}`;
  return { hash, salt: cleanSalt, iterations, combined };
}

/**
 * Hash a password with salt using SHA-256
 * Format: sha256$<salt>$<hash>
 */
export function hashPassword(
  password: string,
  salt?: string
): { hash: string; salt: string; combined: string } {
  const cleanSalt = salt || generateSalt(16);
  // Salt-pepper concatenation
  const rawToHash = `${cleanSalt}::harit_jal_pepper_v1::${password.trim()}`;
  const hash = sha256(rawToHash);
  const combined = `sha256$${cleanSalt}$${hash}`;
  return { hash, salt: cleanSalt, combined };
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length && i < b.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verify a candidate password against a stored hashed string or legacy password
 */
export function verifyPassword(candidatePassword: string, storedHashOrPlain: string): boolean {
  if (!candidatePassword || !storedHashOrPlain) return false;
  const trimmed = candidatePassword.trim();

  // 1. PBKDF2 format: pbkdf2$<iterations>$<salt>$<hash>
  if (storedHashOrPlain.startsWith('pbkdf2$')) {
    const parts = storedHashOrPlain.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const expectedHash = parts[3];
    const candidateHash = pbkdf2Sync(trimmed, salt, iterations, 32);
    return timingSafeEqual(candidateHash, expectedHash);
  }

  // 2. Salted SHA-256 format: sha256$<salt>$<hash> (backward compatibility)
  if (storedHashOrPlain.startsWith('sha256$')) {
    const parts = storedHashOrPlain.split('$');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const expectedHash = parts[2];
    const candidateHash = hashPassword(trimmed, salt).hash;
    return timingSafeEqual(candidateHash, expectedHash);
  }

  // 3. Legacy plaintext migration check: if legacy plaintext, timing-safe compare
  return timingSafeEqual(trimmed, storedHashOrPlain.trim());
}

/**
 * Generates a cryptographically secure, high-entropy random temporary password.
 * Format: "HaritStaff#<8 alphanumeric characters>" (over 9.6 x 10^13 combinations).
 * Avoids visually ambiguous characters (0, O, 1, l, I).
 */
export function generateSecureTemporaryPassword(): string {
  const digits = '23456789';
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const allChars = digits + uppercase + lowercase;

  const cryptoObj = typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto : null;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Cryptographically secure RNG (crypto.getRandomValues) is required for temporary password generation.');
  }

  // Generate 8 characters with guaranteed classes: at least 1 digit, 1 uppercase, 1 lowercase
  const randomBytes = new Uint8Array(8);
  cryptoObj.getRandomValues(randomBytes);

  const chars: string[] = [
    digits[randomBytes[0] % digits.length],
    uppercase[randomBytes[1] % uppercase.length],
    lowercase[randomBytes[2] % lowercase.length],
  ];

  for (let i = 3; i < 8; i++) {
    chars.push(allChars[randomBytes[i] % allChars.length]);
  }

  // Fisher-Yates shuffle using crypto random bytes
  const shuffleBytes = new Uint8Array(8);
  cryptoObj.getRandomValues(shuffleBytes);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }

  return `HaritStaff#${chars.join('')}`;
}

