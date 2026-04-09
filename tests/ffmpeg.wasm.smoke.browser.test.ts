import { describe, expect, test } from "vitest";

describe("ffmpeg.wasm browser smoke", () => {
  test.skip("loads ffmpeg.wasm successfully", async () => {
    const { FFmpegProcessor } = await import("../src/lib/ffmpeg.ts");
    const processor = new FFmpegProcessor();

    await expect(processor.load()).resolves.toBeUndefined();
  }, 120000);

  test.skip("processes a client-side blob input without subtitles", async () => {
    const { FFmpegProcessor } = await import("../src/lib/ffmpeg.ts");
    const processor = new FFmpegProcessor();
    const inputUrl = URL.createObjectURL(
      new Blob([new Uint8Array([10, 20, 30, 40])], { type: "video/mp4" })
    );

    try {
      const outputUrl = await processor.processVideo({
        videoUrl: inputUrl,
        subtitles: [],
      });

      expect(outputUrl.startsWith("blob:")).toBe(true);
      URL.revokeObjectURL(outputUrl);
    } finally {
      URL.revokeObjectURL(inputUrl);
    }
  }, 120000);
});
