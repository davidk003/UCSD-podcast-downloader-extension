import { beforeEach, describe, expect, test, vi } from "vitest";

type MockFFmpegInstance = {
  load: ReturnType<typeof vi.fn>;
  writeFile: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
  readFile: ReturnType<typeof vi.fn>;
  deleteFile: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
};

const mockState = vi.hoisted(() => {
  const instances: MockFFmpegInstance[] = [];

  function createInstance(): MockFFmpegInstance {
    const instance: MockFFmpegInstance = {
      load: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      exec: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue(new Uint8Array([0, 1, 2, 3])),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
    };
    instances.push(instance);
    return instance;
  }

  return {
    instances,
    createInstance,
    FFmpeg: vi.fn(function MockFFmpeg() {
      return createInstance();
    }),
    fetchFile: vi.fn().mockResolvedValue(new Uint8Array([10, 20, 30])),
    toBlobURL: vi.fn(async (url: string) => `blob:${url}`),
  };
});

vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: mockState.FFmpeg,
}));

vi.mock("@ffmpeg/util", () => ({
  fetchFile: mockState.fetchFile,
  toBlobURL: mockState.toBlobURL,
}));

import { FFmpegProcessor } from "../src/lib/ffmpeg.ts";

function latestInstance(): MockFFmpegInstance {
  const instance = mockState.instances[mockState.instances.length - 1];
  if (!instance) {
    throw new Error("No FFmpeg mock instance was created.");
  }
  return instance;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockState.instances.length = 0;

  mockState.FFmpeg.mockImplementation(function MockFFmpeg() {
    return mockState.createInstance();
  });
  mockState.fetchFile.mockReset();
  mockState.fetchFile.mockResolvedValue(new Uint8Array([10, 20, 30]));
  mockState.toBlobURL.mockReset();
  mockState.toBlobURL.mockImplementation(async (url: string) => `blob:${url}`);

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:mock-output"),
  });
});

describe("FFmpegProcessor load", () => {
  test("loads ffmpeg core with expected URLs", async () => {
    const processor = new FFmpegProcessor();

    await processor.load();

    const instance = latestInstance();
    expect(mockState.FFmpeg).toHaveBeenCalledTimes(1);
    expect(mockState.toBlobURL).toHaveBeenCalledWith(
      expect.stringContaining("ffmpeg-core.js"),
      "text/javascript"
    );
    expect(mockState.toBlobURL).toHaveBeenCalledWith(
      expect.stringContaining("ffmpeg-core.wasm"),
      "application/wasm"
    );
    expect(instance.load).toHaveBeenCalledTimes(1);
  });

  test("is idempotent when load is called multiple times", async () => {
    const processor = new FFmpegProcessor();

    await processor.load();
    await processor.load();

    const instance = latestInstance();
    expect(mockState.FFmpeg).toHaveBeenCalledTimes(1);
    expect(instance.load).toHaveBeenCalledTimes(1);
  });

  test("throws a descriptive error when ffmpeg load fails", async () => {
    mockState.FFmpeg.mockImplementationOnce(function MockFFmpeg() {
      return {
      load: vi.fn().mockRejectedValue(new Error("boom")),
      writeFile: vi.fn(),
      exec: vi.fn(),
      readFile: vi.fn(),
      deleteFile: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      };
    });

    const processor = new FFmpegProcessor();

    await expect(processor.load()).rejects.toThrow(
      "Failed to load FFmpeg: Error: boom"
    );
  });
});

describe("FFmpegProcessor processVideo", () => {
  test("auto-loads ffmpeg when processVideo is called first", async () => {
    const processor = new FFmpegProcessor();

    await processor.processVideo({
      videoUrl: "https://example.com/video.mp4",
      subtitles: [],
    });

    const instance = latestInstance();
    expect(mockState.FFmpeg).toHaveBeenCalledTimes(1);
    expect(instance.load).toHaveBeenCalledTimes(1);
  });

  test("builds expected ffmpeg command for a single subtitle", async () => {
    const processor = new FFmpegProcessor();

    await processor.processVideo({
      videoUrl: "https://example.com/video.mp4",
      subtitles: [
        {
          url: "https://example.com/en.srt",
          language: "eng",
          label: "English",
        },
      ],
    });

    const instance = latestInstance();
    expect(instance.exec).toHaveBeenCalledWith([
      "-i",
      "input.mp4",
      "-i",
      "sub_0.srt",
      "-c:v",
      "copy",
      "-c:a",
      "copy",
      "-c:s",
      "mov_text",
      "-map",
      "0:v",
      "-map",
      "0:a",
      "-map",
      "1:0",
      "-metadata:s:s:0",
      "language=eng",
      "-metadata:s:s:0",
      "title=English",
      "output.mp4",
    ]);
  });

  test("uses custom subtitle filename when provided", async () => {
    const processor = new FFmpegProcessor();

    await processor.processVideo({
      videoUrl: "https://example.com/video.mp4",
      subtitles: [
        {
          url: "https://example.com/custom.srt",
          language: "eng",
          label: "English",
          filename: "custom.srt",
        },
      ],
    });

    const instance = latestInstance();
    expect(instance.writeFile).toHaveBeenCalledWith(
      "custom.srt",
      expect.any(Uint8Array)
    );
  });

  test("returns passthrough output and skips exec when subtitles are empty", async () => {
    const processor = new FFmpegProcessor();

    const outputUrl = await processor.processVideo({
      videoUrl: "https://example.com/video.mp4",
      subtitles: [],
    });

    const instance = latestInstance();
    expect(instance.exec).not.toHaveBeenCalled();
    expect(instance.readFile).toHaveBeenCalledWith("input.mp4");
    expect(outputUrl).toBe("blob:mock-output");
  });

  test("falls back to allorigins proxy when direct download fails", async () => {
    mockState.fetchFile
      .mockRejectedValueOnce(new Error("cors"))
      .mockResolvedValueOnce(new Uint8Array([99]));

    const processor = new FFmpegProcessor();

    await processor.processVideo({
      videoUrl: "https://example.com/video.mp4",
      subtitles: [],
    });

    expect(mockState.fetchFile).toHaveBeenCalledTimes(2);
    expect(mockState.fetchFile).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("https://api.allorigins.win/raw?url=")
    );
    expect(mockState.fetchFile).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(encodeURIComponent("https://example.com/video.mp4"))
    );
  });

  test("throws when direct and proxy download both fail", async () => {
    mockState.fetchFile.mockRejectedValue(new Error("network down"));

    const processor = new FFmpegProcessor();

    await expect(
      processor.processVideo({
        videoUrl: "https://example.com/video.mp4",
        subtitles: [],
      })
    ).rejects.toThrow("Failed to download input.mp4 even with proxy");
  });

  test("continues processing when subtitle download fails", async () => {
    mockState.fetchFile
      .mockResolvedValueOnce(new Uint8Array([1, 2, 3]))
      .mockRejectedValueOnce(new Error("subtitle blocked by cors"))
      .mockRejectedValueOnce(new Error("proxy failed"));

    const onLog = vi.fn();
    const processor = new FFmpegProcessor();

    const outputUrl = await processor.processVideo({
      videoUrl: "https://example.com/video.mp4",
      subtitles: [
        {
          url: "https://example.com/subtitle.srt",
          language: "eng",
          label: "English",
        },
      ],
      onLog,
    });

    const instance = latestInstance();
    expect(instance.exec).not.toHaveBeenCalled();
    expect(instance.readFile).toHaveBeenCalledWith("input.mp4");
    expect(onLog).toHaveBeenCalledWith(
      "Failed to download subtitle: English",
      "warning"
    );
    expect(outputUrl).toBe("blob:mock-output");
  });

  test("cleans up temporary files after processing", async () => {
    const processor = new FFmpegProcessor();

    await processor.processVideo({
      videoUrl: "https://example.com/video.mp4",
      subtitles: [
        {
          url: "https://example.com/subtitle.srt",
          language: "eng",
          label: "English",
          filename: "english.srt",
        },
      ],
    });

    const instance = latestInstance();
    expect(instance.deleteFile).toHaveBeenCalledWith("input.mp4");
    expect(instance.deleteFile).toHaveBeenCalledWith("output.mp4");
    expect(instance.deleteFile).toHaveBeenCalledWith("english.srt");
  });

  test("unsubscribes progress handler in finally", async () => {
    const processor = new FFmpegProcessor();

    await processor.processVideo({
      videoUrl: "https://example.com/video.mp4",
      subtitles: [],
    });

    const instance = latestInstance();
    const progressSubscription = instance.on.mock.calls.find(
      (call) => call[0] === "progress"
    );

    expect(progressSubscription).toBeDefined();
    expect(instance.off).toHaveBeenCalledWith("progress", progressSubscription?.[1]);
  });

  test("maps ffmpeg progress events to percentage callback", async () => {
    mockState.FFmpeg.mockImplementationOnce(function MockFFmpeg() {
      const instance = mockState.createInstance();
      instance.on.mockImplementation((event, handler) => {
        if (event === "progress") {
          handler({ progress: 0.37 });
        }
      });
      return instance;
    });

    const onProgress = vi.fn();
    const processor = new FFmpegProcessor();

    await processor.processVideo({
      videoUrl: "https://example.com/video.mp4",
      subtitles: [],
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith(37);
  });

  test("reports process errors through onLog before rethrowing", async () => {
    const processor = new FFmpegProcessor();

    await processor.load();
    const instance = latestInstance();
    instance.exec.mockRejectedValueOnce(new Error("ffmpeg failed"));

    const onLog = vi.fn();

    await expect(
      processor.processVideo({
        videoUrl: "https://example.com/video.mp4",
        subtitles: [
          {
            url: "https://example.com/subtitle.srt",
            language: "eng",
            label: "English",
          },
        ],
        onLog,
      })
    ).rejects.toThrow("ffmpeg failed");

    expect(onLog).toHaveBeenCalledWith(
      "Processing failed: ffmpeg failed",
      "error"
    );
  });
});
