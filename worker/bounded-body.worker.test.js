import { expect, it, vi } from "vitest";
import { BodyTooLargeError, readBoundedBody } from "./lib/bounded-body.js";

it("accepts an exact byte limit and cancels a stream as soon as it exceeds it", async () => {
  const bounded = await readBoundedBody(new Response("字"), 3);
  expect(await bounded.text()).toBe("字");
  const cancel = vi.fn();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(Uint8Array.of(1, 2));
      controller.enqueue(Uint8Array.of(3, 4));
    },
    cancel,
  });
  await expect(readBoundedBody(new Response(stream), 3)).rejects.toBeInstanceOf(
    BodyTooLargeError,
  );
  expect(cancel).toHaveBeenCalledOnce();
});
