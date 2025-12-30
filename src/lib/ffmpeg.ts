import { FFmpeg, type FileData } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import coreURL from "@ffmpeg/core/dist/esm/ffmpeg-core.js?url";
import wasmURL from "@ffmpeg/core/dist/esm/ffmpeg-core.wasm?url";

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
}

export class FFmpegProcessor {
  private ffmpeg: FFmpeg | null = null;
  public ffmpegLoaded: boolean = false;
  public videoLoaded: boolean = false;
  public subtitlesLoaded: boolean = false;

  /**
   * Initialize and load the FFmpeg engine
   */
  async load(): Promise<void> {
    if (this.ffmpeg) return;

    try {
      this.ffmpeg = new FFmpeg();

      // Load from local package instead of CDN
      await this.ffmpeg.load({
        coreURL: await toBlobURL(coreURL, "text/javascript"),
        wasmURL: await toBlobURL(wasmURL, "application/wasm"),
      });
    } catch (error) {
      this.ffmpeg = null;
      this.ffmpegLoaded = false;
      console.error("Failed to load FFmpeg:", error);
      throw new Error(`Failed to load FFmpeg: ${error}`);
    }
    this.ffmpegLoaded = true;
  }

  /**
   * Helper to cleanup files from FFmpeg virtual filesystem
   * @param filenames - Array of filenames to delete
   */
  private async cleanupFiles(...filenames: string[]): Promise<void> {
    if (!this.ffmpeg) return;

    for (const filename of filenames) {
      try {
        await this.ffmpeg.deleteFile(filename);
      } catch(error) {
        console.error(`Error during file cleanup: ${filename}: ${error}`);
      }
    }
  }

  /**
   * Helper to download a file with proxy fallback
   * @param url - The URL of the file to download
   * @param filename - The filename to save the file as
   */
  private async downloadFile(url: string, filename: string): Promise<void> {
    if (!this.ffmpeg) throw new Error("FFmpeg not initialized");

    try {
      await this.ffmpeg.writeFile(filename, await fetchFile(url));
    } catch (error) {
      console.error(error);
      console.error(
        `Failed to download ${filename} from ${url}: ${error}`
      );

      // Fallback to proxy if direct download fails (CORS)
      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
          url
        )}`;
        await this.ffmpeg.writeFile(filename, await fetchFile(proxyUrl));
      } catch (proxyError) {
        console.error(proxyError);
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
    if (!this.ffmpeg) {
      await this.load();
    }
    const ffmpeg = this.ffmpeg!;

    // Create progress handler so we can remove it later
    const progressHandler = ({ progress }: { progress: number }) => {
      if (options.onProgress) options.onProgress(Math.round(progress * 100));
    };
    ffmpeg.on("progress", progressHandler);

    const { videoUrl, subtitles } = options;
    let subFiles: string[] = [];

    try {
      // Download Video
      console.log("Downloading video file...");
      await this.downloadFile(videoUrl, "input.mp4");
      console.log("Video downloaded successfully");

      // Download Subtitles
      console.log("Downloading subtitle files...");
      subFiles = await this.downloadSubtitles(subtitles);
      console.log("Subtitle files downloaded successfully");

      // Process video and subtitles
      if (subFiles.length > 0) {
        console.log("Generating FFmpeg command...");
        const cmd = this.generateFfmpegCommand(subFiles, subtitles);

        console.log("Executing FFmpeg command...");
        await ffmpeg.exec(cmd);
        console.log("FFmpeg command complete");
      }
      
      const filename = (subFiles.length > 0) ? "output.mp4" : "input.mp4";
      const data: FileData = await ffmpeg.readFile(filename);
      return URL.createObjectURL(
        new Blob([(data as Uint8Array).buffer as ArrayBuffer], { type: "video/mp4" })
      );
    } catch (error: any) {
      console.error(`Processing failed: ${error.message}`);
      throw error;
    } finally {
      // Remove progress listener
      ffmpeg.off("progress", progressHandler);
      // Cleanup files from ffmpeg virtual filesystem
      const outputFile = (subFiles.length > 0) ? "output.mp4" : "input.mp4";
      console.log("Cleaning up files...");
      await this.cleanupFiles("input.mp4", outputFile, ...subFiles);
      console.log("Files cleaned up");
    }
  }

  /**
   * Download subtitle files
   * @param subtitles - Array of subtitle inputs to download
   * @returns Array of successfully downloaded subtitle filenames
   */
  private async downloadSubtitles(
    subtitles: SubtitleInput[],
  ): Promise<string[]> {
    const subFiles: string[] = [];

    if (subtitles.length === 0) return subFiles;

    console.log("Downloading subtitle files...");

    for (let i = 0; i < subtitles.length; i++) {
      const sub = subtitles[i];
      const filename = sub.filename || `sub_${i}.srt`;

      try {
        await this.downloadFile(sub.url, filename);
        subFiles.push(filename);
        console.log(`Downloaded subtitle: ${sub.label}`);
      } catch (e) {
        console.error(`Failed to download subtitle: ${sub.label}`);
      }
    }

    return subFiles;
  }

  private generateFfmpegCommand(
    subFiles: string[],
    subtitles: SubtitleInput[],
  ): string[] {
    const cmd: string[] = ["-i", "input.mp4"];
  
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
  
    return cmd;
  }
  
}

  


// Export a singleton instance for convenience
export const ffmpegProcessor = new FFmpegProcessor();
