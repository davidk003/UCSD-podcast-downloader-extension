import { extractKalturaUrls } from "./kaltura";

/**
 * Log entry for progress display
 */
export interface LogEntry {
  timestamp: Date;
  message: string;
  type: "info" | "success" | "error" | "warning";
}

/**
 * Result from processing HTML to extract Kaltura URLs
 */
export interface ProcessResult {
  videoUrl: string;
  subtitleUrl: string | null;
}

/**
 * Extracts HTML from the current active tab using Chrome scripting API
 * @returns The full HTML string of the page
 * @throws Error if extraction fails
 */
export async function extractHtml(): Promise<string> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab.id) {
    throw new Error("No active tab found");
  }

  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.documentElement.outerHTML,
  });

  if (!result || !result[0] || !result[0].result) {
    throw new Error("Failed to extract HTML from page");
  }

  return result[0].result;
}

/**
 * Processes extracted HTML to get Kaltura video and subtitle URLs
 * @param html - The HTML string to process
 * @returns Object containing videoUrl and optional subtitleUrl
 * @throws Error if processing fails or no Kaltura info found
 */
export async function processHtml(html: string): Promise<ProcessResult> {
  const result = await extractKalturaUrls(html);

  if (!result) {
    throw new Error(
      "Failed to extract Kaltura URLs. Are you on a valid podcast page?"
    );
  }

  return result;
}

/**
 * Downloads a video from URL and triggers browser download
 * @param videoUrl - The URL of the video to download
 * @param onProgress - Optional callback for progress updates (0-100)
 */
export async function downloadVideo(
  videoUrl: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  // Use fetch to download the video with progress tracking
  const response = await fetch(videoUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch video: ${response.status}`);
  }

  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    chunks.push(value);
    received += value.length;

    if (total > 0 && onProgress) {
      onProgress(Math.round((received / total) * 100));
    }
  }

  // Combine chunks into a single blob
  const blob = new Blob(chunks as any, { type: "video/mp4" });
  const url = URL.createObjectURL(blob);

  // Trigger download using Chrome downloads API or fallback to anchor
  try {
    await chrome.downloads.download({
      url: url,
      filename: "podcast.mp4",
      saveAs: true,
    });
  } catch {
    // Fallback for environments without chrome.downloads
    const a = document.createElement("a");
    a.href = url;
    a.download = "podcast.mp4";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Clean up the object URL after a delay
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
