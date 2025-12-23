import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

export interface SubtitleInput {
  url: string;
  language: string; // e.g. 'eng'
  label: string; // e.g. 'English'
  filename?: string; // Optional custom filename, defaults to sub_{i}.srt
}

export interface ProcessingOptions {
  videoUrl: string;
  subtitles: SubtitleInput[];
  onProgress?: (progress: number) => void;
  onLog?: (
    message: string,
    type: "info" | "error" | "success" | "warning"
  ) => void;
}

export class FFmpegProcessor {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded: boolean = false;

  /**
   * Initialize and load the FFmpeg engine
   */
  async load(): Promise<void> {
    if (this.isLoaded && this.ffmpeg) return;

    try {
      this.ffmpeg = new FFmpeg();

      // Use single-threaded version to avoid SharedArrayBuffer requirements
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
      await this.ffmpeg.load({
        coreURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.js`,
          "text/javascript"
        ),
        wasmURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          "application/wasm"
        ),
      });

      this.isLoaded = true;
    } catch (error) {
      console.error("Failed to load FFmpeg:", error);
      throw new Error(`Failed to load FFmpeg: ${error}`);
    }
  }

  /**
   * Helper to download a file with proxy fallback
   */
  private async downloadFile(
    url: string,
    filename: string,
    onLog?: (msg: string, type: "info" | "warning" | "success") => void
  ): Promise<void> {
    if (!this.ffmpeg) throw new Error("FFmpeg not initialized");

    try {
      await this.ffmpeg.writeFile(filename, await fetchFile(url));
    } catch (error) {
      if (onLog)
        onLog(
          `Direct download failed for ${filename}, trying via proxy...`,
          "warning"
        );

      // Fallback to proxy if direct download fails (CORS)
      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
          url
        )}`;
        await this.ffmpeg.writeFile(filename, await fetchFile(proxyUrl));
      } catch (proxyError) {
        throw new Error(
          `Failed to download ${filename} even with proxy: ${proxyError}`
        );
      }
    }
  }

  /**
   * Process video and subtitles into a single file
   * @returns Blob URL of the final video
   */
  async processVideo(options: ProcessingOptions): Promise<string> {
    if (!this.isLoaded || !this.ffmpeg) {
      await this.load();
    }
    const ffmpeg = this.ffmpeg!;

    // Create progress handler so we can remove it later (prevents listener accumulation)
    const progressHandler = ({ progress }: { progress: number }) => {
      if (options.onProgress) options.onProgress(Math.round(progress * 100));
    };
    ffmpeg.on("progress", progressHandler);

    const { videoUrl, subtitles, onLog } = options;
    const subFiles: string[] = [];

    try {
      // 1. Download Video
      if (onLog) onLog("Downloading video file...", "info");
      await this.downloadFile(videoUrl, "input.mp4", onLog);
      if (onLog) onLog("Video downloaded successfully", "success");

      // 2. Download Subtitles
      if (subtitles.length > 0) {
        if (onLog) onLog("Downloading subtitle files...", "info");

        for (let i = 0; i < subtitles.length; i++) {
          const sub = subtitles[i];
          const filename = sub.filename || `sub_${i}.srt`;

          try {
            await this.downloadFile(sub.url, filename, onLog);
            subFiles.push(filename);
            if (onLog) onLog(`Downloaded subtitle: ${sub.label}`, "success");
          } catch (e) {
            if (onLog)
              onLog(`Failed to download subtitle: ${sub.label}`, "warning");
          }
        }
      }

      // 3. Process
      if (subFiles.length > 0) {
        if (onLog) onLog("Embedding subtitles...", "info");

        const cmd = ["-i", "input.mp4"];

        // Add subtitle inputs
        subFiles.forEach((file) => cmd.push("-i", file));

        // Map streams
        cmd.push("-c:v", "copy");
        cmd.push("-c:a", "copy");
        cmd.push("-c:s", "mov_text"); // mp4 compatible subtitles

        cmd.push("-map", "0:v");
        cmd.push("-map", "0:a");

        subFiles.forEach((_, i) => {
          cmd.push("-map", `${i + 1}:0`);
          const lang = subtitles[i]?.language || "eng";
          cmd.push(`-metadata:s:s:${i}`, `language=${lang}`);
          if (subtitles[i]?.label) {
            cmd.push(`-metadata:s:s:${i}`, `title=${subtitles[i].label}`);
          }
        });

        cmd.push("output.mp4");

        if (onLog) onLog("Running FFmpeg command...", "info");
        await ffmpeg.exec(cmd);
        if (onLog) onLog("FFmpeg processing complete", "success");

        const data = await ffmpeg.readFile("output.mp4");
        return URL.createObjectURL(
          new Blob([data as any], { type: "video/mp4" })
        );
      } else {
        if (onLog)
          onLog(
            "No subtitles to filter, passing through original video...",
            "info"
          );
        const data = await ffmpeg.readFile("input.mp4");
        return URL.createObjectURL(
          new Blob([data as any], { type: "video/mp4" })
        );
      }
    } catch (error: any) {
      if (onLog) onLog(`Processing failed: ${error.message}`, "error");
      throw error;
    } finally {
      // Remove progress listener to prevent accumulation on subsequent calls
      ffmpeg.off("progress", progressHandler);

      // Cleanup files from ffmpeg virtual filesystem
      try {
        await ffmpeg.deleteFile("input.mp4");
      } catch {
        // ignore if file doesn't exist
      }
      try {
        await ffmpeg.deleteFile("output.mp4");
      } catch {
        // ignore if file doesn't exist
      }
      // Delete subtitle files
      for (const subFile of subFiles) {
        try {
          await ffmpeg.deleteFile(subFile);
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }
}

// Export a singleton instance for convenience
export const ffmpegProcessor = new FFmpegProcessor();
