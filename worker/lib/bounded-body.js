export class BodyTooLargeError extends Error {}

// Materialize only bodies that fit the parser's byte budget, including when
// Content-Length is unavailable. Both JSON and multipart need a complete body.
export async function readBoundedBody(message, maxBytes) {
  if (Number(message.headers.get("content-length")) > maxBytes) {
    throw new BodyTooLargeError();
  }
  const parts = [];
  let bytes = 0;
  const reader = message.body?.getReader();
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBytes) {
          await reader.cancel();
          throw new BodyTooLargeError();
        }
        parts.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  return new Response(new Blob(parts), {
    headers: { "content-type": message.headers.get("content-type") || "" },
  });
}
