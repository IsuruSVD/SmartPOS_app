import * as Crypto from 'expo-crypto';

/**
 * Generates a UUID v4 string through Expo Crypto's platform-backed API.
 * Call from the app's JavaScript runtime, not a worker.
 */
export function newId(): string {
  return Crypto.randomUUID();
}
