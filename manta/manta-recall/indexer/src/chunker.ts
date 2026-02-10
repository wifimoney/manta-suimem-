ChunkResult {
  text    → the chunk content (string)
  index   → position in the sequence (0, 1, 2, ...)
  tokens  → estimated token count (number)
}

tokens = Math.ceil(text.length / 4)

chunk(text: string, maxTokens?: number): ChunkResult[]