/** Vectors are stored as base64 of a little-endian Float32Array (works the same in Workers and Bun). */
export function encodeVector(vector: number[]): string {
  const bytes = new Uint8Array(new Float32Array(vector).buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

/** Typed array (not a copied number[]): this runs once per announcement per question. */
export function decodeVector(encoded: string): Float32Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}
