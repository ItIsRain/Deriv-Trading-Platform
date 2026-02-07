// Call Intent Detector
// Detects call requests and extracts phone numbers from user messages

export interface CallIntent {
  detected: boolean;
  phoneNumber?: string;
  rawMatch?: string;
}

// Patterns to detect call requests with phone numbers
const CALL_PATTERNS = [
  /call\s+(?:me\s+)?(?:at\s+)?(\+?[\d\s\-\(\)]{10,})/i,
  /phone\s+(?:me\s+)?(?:at\s+)?(\+?[\d\s\-\(\)]{10,})/i,
  /ring\s+(?:me\s+)?(?:at\s+)?(\+?[\d\s\-\(\)]{10,})/i,
  /dial\s+(?:me\s+)?(?:at\s+)?(\+?[\d\s\-\(\)]{10,})/i,
  /reach\s+(?:me\s+)?(?:at\s+)?(\+?[\d\s\-\(\)]{10,})/i,
  /contact\s+(?:me\s+)?(?:at\s+)?(\+?[\d\s\-\(\)]{10,})/i,
  /(?:my\s+)?(?:number|phone)\s+(?:is\s+)?(\+?[\d\s\-\(\)]{10,})/i,
];

// General intent patterns (without number in same sentence)
const GENERAL_CALL_PATTERNS = [
  /(?:let's|let us)\s+(?:discuss|talk|chat)\s+(?:over|on|via)\s+(?:a\s+)?(?:call|phone)/i,
  /(?:can|could)\s+(?:you|we)\s+(?:discuss|talk)\s+(?:over|on|via)\s+(?:a\s+)?(?:call|phone)/i,
  /(?:call|phone)\s+me\b/i,
  /(?:give|schedule)\s+(?:me\s+)?a\s+call/i,
];

// Phone number pattern for standalone detection
const PHONE_NUMBER_PATTERN = /(\+?[\d][\d\s\-\(\)]{9,}[\d])/g;

/**
 * Normalizes a phone number by removing all non-digit characters except leading +
 */
export function normalizePhoneNumber(phone: string): string {
  const hasPlus = phone.trim().startsWith('+');
  const digits = phone.replace(/[^\d]/g, '');
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Validates if a string looks like a valid phone number
 */
export function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  const digitsOnly = normalized.replace(/^\+/, '');

  // Must have at least 10 digits (minimum for international)
  // and at most 15 digits (max for E.164)
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}

/**
 * Detects if a message contains a call request and extracts the phone number
 */
export function detectCallIntent(message: string): CallIntent {
  // First, try patterns that include phone numbers
  for (const pattern of CALL_PATTERNS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const phoneNumber = normalizePhoneNumber(match[1]);
      if (isValidPhoneNumber(phoneNumber)) {
        return {
          detected: true,
          phoneNumber,
          rawMatch: match[0],
        };
      }
    }
  }

  // Check for general call intent
  let hasCallIntent = false;
  for (const pattern of GENERAL_CALL_PATTERNS) {
    if (pattern.test(message)) {
      hasCallIntent = true;
      break;
    }
  }

  if (hasCallIntent) {
    // Try to find a phone number anywhere in the message
    const phoneMatches = message.match(PHONE_NUMBER_PATTERN);
    if (phoneMatches) {
      for (const match of phoneMatches) {
        const phoneNumber = normalizePhoneNumber(match);
        if (isValidPhoneNumber(phoneNumber)) {
          return {
            detected: true,
            phoneNumber,
            rawMatch: match,
          };
        }
      }
    }

    // Call intent detected but no valid phone number found
    return {
      detected: true,
      phoneNumber: undefined,
    };
  }

  return {
    detected: false,
  };
}

/**
 * Extracts phone number from a message even without explicit call intent
 */
export function extractPhoneNumber(message: string): string | null {
  const matches = message.match(PHONE_NUMBER_PATTERN);
  if (matches) {
    for (const match of matches) {
      const normalized = normalizePhoneNumber(match);
      if (isValidPhoneNumber(normalized)) {
        return normalized;
      }
    }
  }
  return null;
}
