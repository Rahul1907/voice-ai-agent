/**
 * Deterministic, normalized hashed bag-of-words embedding generator.
 * Produces unit-length vectors where text keyword overlap yields higher cosine similarity.
 */
export function generateBagOfWordsEmbedding(text: string, dim: number = 1024): number[] {
  const vector = new Float64Array(dim);

  // Normalize and tokenize text into lowercase word tokens
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) {
    return Array.from(vector);
  }

  // Bag-of-words with deterministic 32-bit FNV-1a hash
  for (const token of tokens) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    const index = (hash >>> 0) % dim;
    const current = vector[index] ?? 0;
    vector[index] = current + 1;
  }

  // L2 normalization: sqrt(sum(v_i^2))
  let sumSq = 0;
  for (let i = 0; i < dim; i++) {
    const val = vector[i] ?? 0;
    sumSq += val * val;
  }
  const norm = Math.sqrt(sumSq);

  const result: number[] = new Array(dim);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      result[i] = (vector[i] ?? 0) / norm;
    }
  } else {
    for (let i = 0; i < dim; i++) {
      result[i] = 0;
    }
  }

  return result;
}

/**
 * Computes cosine similarity between two unit-normalized vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vectors must have the same dimension (${a.length} vs ${b.length})`);
  }
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    const valA = a[i] ?? 0;
    const valB = b[i] ?? 0;
    dot += valA * valB;
  }
  return dot;
}
