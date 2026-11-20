/**
 * Text normalizer for TTS synthesis.
 * Strips markdown symbols, URLs, and emojis; expands common currency & symbols; preserves numbers and words.
 */
export function normalizeText(text: string): string {
  if (!text) return '';

  let normalized = text;

  // 1. Markdown links: [text](url) -> text (run before stripping raw URLs so link text is preserved)
  normalized = normalized.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

  // 2. Remove remaining raw URLs
  normalized = normalized.replace(/https?:\/\/[^\s)]+/gi, '');

  // 3. Strip Markdown syntax
  // Code blocks & inline code
  normalized = normalized.replace(/```[\s\S]*?```/g, ' ');
  normalized = normalized.replace(/`([^`]+)`/g, '$1');
  // Headers: # Header
  normalized = normalized.replace(/^\s*#{1,6}\s+/gm, ' ');
  normalized = normalized.replace(/#+/g, '');
  // Blockquotes: > quote
  normalized = normalized.replace(/^\s*>\s*/gm, ' ');
  // Unordered list bullets: * list or - list or + list (must have space after bullet)
  normalized = normalized.replace(/^\s*[-+*]\s+/gm, ' ');
  // Bold, italic, strikethrough: **bold**, *italic*, ~~strike~~, __bold__, _italic_
  normalized = normalized.replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1');

  // 4. Remove Emojis & Pictographs (Unicode Property Escape)
  try {
    normalized = normalized.replace(/\p{Extended_Pictographic}/gu, ' ');
  } catch {
    // Fallback for older regex engines
    normalized = normalized.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/gu, ' ');
  }

  // 4. Expand currency and special symbols
  normalized = normalized.replace(/₹\s*(\d+)/g, '$1 rupees');
  normalized = normalized.replace(/₹/g, ' rupees ');
  normalized = normalized.replace(/\$\s*(\d+)/g, '$1 dollars');
  normalized = normalized.replace(/\$/g, ' dollars ');
  normalized = normalized.replace(/€\s*(\d+)/g, '$1 euros');
  normalized = normalized.replace(/€/g, ' euros ');
  normalized = normalized.replace(/£\s*(\d+)/g, '$1 pounds');
  normalized = normalized.replace(/£/g, ' pounds ');
  normalized = normalized.replace(/%/g, ' percent ');
  normalized = normalized.replace(/&/g, ' and ');
  normalized = normalized.replace(/@/g, ' at ');
  normalized = normalized.replace(/\+/g, ' plus ');
  normalized = normalized.replace(/=/g, ' equals ');

  // 5. Clean up duplicate spaces and trim
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}
