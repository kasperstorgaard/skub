/** Compresses bytes with the built-in raw deflate stream. */
export function deflate(bytes: Uint8Array) {
  return pipe(bytes, new CompressionStream("deflate-raw"));
}

/** Decompresses bytes from {@link deflate}; throws on malformed input. */
export function inflate(bytes: Uint8Array) {
  return pipe(bytes, new DecompressionStream("deflate-raw"));
}

async function pipe(bytes: Uint8Array, transform: TransformStream) {
  const stream = ReadableStream.from([bytes]).pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
