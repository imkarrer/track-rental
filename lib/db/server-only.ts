/**
 * Server-only utilities
 * This file helps ensure server-only code doesn't leak to the client
 */

export function assertServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error('This code can only run on the server')
  }
}

