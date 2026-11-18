const DEVICE_TOKEN_KEY = 'muzdyq-device-token'

function randomToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * An anonymous, random token that only groups rate-limit buckets on the
 * server. It is not linked to a person or an account and can be cleared by
 * removing site data.
 */
export function getDeviceToken(): string {
  if (typeof localStorage === 'undefined') return randomToken()
  try {
    const existing = localStorage.getItem(DEVICE_TOKEN_KEY)
    if (existing) return existing
    const token = randomToken()
    localStorage.setItem(DEVICE_TOKEN_KEY, token)
    return token
  } catch {
    return randomToken()
  }
}

export function newClientUuid(): string {
  return randomToken()
}

export function clearDeviceToken(): void {
  try {
    localStorage.removeItem(DEVICE_TOKEN_KEY)
  } catch {
    // Storage may be unavailable in private modes.
  }
}
