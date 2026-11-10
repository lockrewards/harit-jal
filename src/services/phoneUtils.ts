/**
 * ====================================================================
 * HARIT JAL™ (हरित जल) — INDIAN MOBILE NUMBER NORMALIZATION & UTILITIES
 * 
 * Standards Complied:
 *   - E.164 International Public Telecommunication Numbering Plan
 *   - Telecom Regulatory Authority of India (TRAI) National Numbering Plan
 *   - Valid Indian mobile numbers are 10 digits starting with [6, 7, 8, 9]
 * ====================================================================
 */

export interface NormalizedPhoneResult {
  isValid: boolean;
  e164: string;           // E.g., "+919811234567"
  national: string;       // E.g., "9811234567"
  digits10: string;       // E.g., "9811234567"
  formattedDisplay: string; // E.g., "+91 98112 34567"
  rawDigits: string;
}

/**
 * Checks if an input string is an email address rather than a phone number.
 */
export function isEmailIdentifier(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  return trimmed.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * Normalizes an Indian mobile number into canonical E.164 format and 10-digit national format.
 * Supports:
 *   - 10 digits: "9811234567"
 *   - E.164 with plus: "+919811234567", "+91 98112 34567"
 *   - International without plus: "919811234567", "91-9811234567"
 *   - National trunk prefix: "09811234567", "0 98112 34567"
 *   - Mixed delimiters: "+91 (98112) 34567", "091-98112-34567"
 */
export function normalizeIndianPhoneNumber(input: string): NormalizedPhoneResult {
  const emptyResult: NormalizedPhoneResult = {
    isValid: false,
    e164: '',
    national: '',
    digits10: '',
    formattedDisplay: '',
    rawDigits: '',
  };

  if (!input || typeof input !== 'string') {
    return emptyResult;
  }

  // Extract all numeric digits
  const rawDigits = input.replace(/\D/g, '');

  let digits10 = '';

  if (rawDigits.length === 10) {
    // Standard 10-digit Indian mobile
    digits10 = rawDigits;
  } else if (rawDigits.length === 11 && rawDigits.startsWith('0')) {
    // 0-prefixed 10-digit mobile (trunk prefix)
    digits10 = rawDigits.slice(1);
  } else if (rawDigits.length === 12 && rawDigits.startsWith('91')) {
    // 91-prefixed 10-digit mobile (country code without +)
    digits10 = rawDigits.slice(2);
  } else if (rawDigits.length === 13 && rawDigits.startsWith('091')) {
    // 091-prefixed 10-digit mobile
    digits10 = rawDigits.slice(3);
  } else {
    // Invalid length for Indian mobile
    return { ...emptyResult, rawDigits };
  }

  // Validate TRAI first digit requirement: Indian mobile series start with 6, 7, 8, or 9
  const firstDigit = digits10.charAt(0);
  if (!['6', '7', '8', '9'].includes(firstDigit)) {
    return { ...emptyResult, rawDigits, digits10 };
  }

  const e164 = `+91${digits10}`;
  const formattedDisplay = `+91 ${digits10.slice(0, 5)} ${digits10.slice(5)}`;

  return {
    isValid: true,
    e164,
    national: digits10,
    digits10,
    formattedDisplay,
    rawDigits,
  };
}

/**
 * Checks whether an identifier string is a valid Indian mobile number.
 */
export function isValidIndianMobile(input: string): boolean {
  return normalizeIndianPhoneNumber(input).isValid;
}

/**
 * Checks whether an identifier could be a mobile number (contains only digits, spaces, plus, dashes, parentheses).
 */
export function isPotentialPhoneNumber(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  if (trimmed.includes('@')) return false;
  // Contains at least 3 digits and only standard phone punctuation
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 3 && /^[\d\s+\-()]+$/.test(trimmed);
}
