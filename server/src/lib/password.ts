/**
 * BErozgar — Password Hashing (Argon2)
 *
 * Argon2id is the recommended algorithm for password hashing.
 * Uses the argon2 npm package (native bindings).
 */

import argon2 from 'argon2';

/** Hash a plaintext password using Argon2id */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536,   // 64 MB
    timeCost: 3,         // 3 iterations
    parallelism: 4,
  });
}

/** Verify a plaintext password against a stored hash */
export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  return argon2.verify(hash, plain);
}
