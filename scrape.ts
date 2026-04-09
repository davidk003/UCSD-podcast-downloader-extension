import axios from "axios";

export interface KalturaInfo {
  entryId: string;
  partnerId: string;
  ks: string | null;
}

export interface SubtitleTrack {
  id: string;
  language: string;
  languageCode: string;
  label: string;
  isDefault: boolean;
  displayOnPlayer: boolean;
  accuracy: number;
  size: number;
}

/**
 * Extract Kaltura video information from the podcast page HTML
 */
export async function extractKalturaInfo(
  url: string
): Promise<KalturaInfo | null> {
  try {
    // We need to use a proxy to avoid CORS issues since we're fetching from the client
    // In a real production app, this should be done via a backend proxy
    // For this demo, we'll try to fetch directly, but if it fails due to CORS,
    // we might need a workaround or ask the user to provide the HTML source

    // Note: Since we are in a web environment, we can't easily bypass CORS for arbitrary websites
    // However, for the purpose of this tool, we will assume we can fetch or the user provides the content
    // For now, let's try to fetch through a CORS proxy if available, or fail gracefully

    const response = await axios.get(
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    );
    const html = response.data;

    // Extract entry_id (video identifier)
    const entryIdMatch = html.match(/entry_id['":\s=]+([a-zA-Z0-9_-]+)/);

    // Extract partner_id (Kaltura account ID)
    const partnerIdMatch = html.match(/\/p\/(\d+)\//);

    // Extract KS token (Kaltura Session - temporary auth token)
    const ksMatch = html.match(/ks['":\s=]+([a-zA-Z0-9_-]+)/);

    if (!entryIdMatch || !partnerIdMatch) {
      console.error("Failed to extract required Kaltura configuration");
      return null;
    }

    return {
      entryId: entryIdMatch[1],
      partnerId: partnerIdMatch[1],
      ks: ksMatch ? ksMatch[1] : null,
    };
  } catch (error) {
    console.error("Error fetching page:", error);
    throw new Error("Failed to fetch page. Please check the URL or try again.");
  }
}

/**
 * Get available subtitle information from Kaltura API
 */
export async function getSubtitleInfo(
  info: KalturaInfo
): Promise<SubtitleTrack[]> {
  if (!info.ks) {
    console.warn("No KS token available, cannot fetch subtitles");
    return [];
  }

  const apiUrl = `https://cdnapisec.kaltura.com/api_v3/index.php?service=caption_captionasset&apiVersion=3.1&expiry=86400&clientTag=kwidget:v2.101&format=1&ignoreNull=1&action=list&filter:objectType=KalturaAssetFilter&filter:entryIdEqual=${info.entryId}&filter:statusEqual=2&pager:pageSize=50&ks=${info.ks}`;

  try {
    const response = await axios.get(apiUrl);
    const data = response.data;

    if (data.objects && data.objects.length > 0) {
      return data.objects.map((sub: any) => ({
        id: sub.id,
        language: sub.language || "Unknown",
        languageCode: sub.languageCode || "en",
        label: sub.label || "Subtitle",
        isDefault: sub.isDefault || false,
        displayOnPlayer: sub.displayOnPlayer !== false,
        accuracy: sub.accuracy || 0,
        size: sub.size || 0,
      }));
    }

    return [];
  } catch (error) {
    console.error("Error fetching subtitle info:", error);
    return [];
  }
}

/**
 * Get the download URL for a subtitle file
 */
export async function getSubtitleUrl(
  captionId: string,
  ks: string
): Promise<string | null> {
  const apiUrl = `https://cdnapisec.kaltura.com/api_v3/index.php?service=caption_captionasset&action=getUrl&id=${captionId}&format=1&ks=${ks}`;

  try {
    const response = await axios.get(apiUrl);
    // Response is a JSON string containing the URL
    const url = response.data;
    return url.replace(/\\/g, "/"); // Unescape slashes
  } catch (error) {
    console.error("Error getting subtitle URL:", error);
    return null;
  }
}

/**
 * Get the direct download URL using Kaltura's playManifest API
 */
export async function getDownloadUrl(
  info: KalturaInfo
): Promise<string | null> {
  let apiUrl = `https://cdnapisec.kaltura.com/p/${info.partnerId}/sp/${info.partnerId}00/playManifest/entryId/${info.entryId}/format/download/protocol/https`;

  if (info.ks) {
    apiUrl += `/ks/${info.ks}`;
  }

  try {
    // We use a HEAD request to get the redirect URL
    // Note: In browser, we might not be able to read the redirect URL directly if it's opaque
    // But for Kaltura, usually the API returns a 302.
    // If we can't follow redirects in browser due to CORS, we might need to use the API URL directly
    // and hope the browser handles the redirect during fetch/download

    // For the purpose of this implementation, we'll return the API URL directly
    // The browser's fetch or ffmpeg.wasm's fetchFile should handle the redirect
    return apiUrl;
  } catch (error) {
    console.error("Error requesting download URL:", error);
    return null;
  }
}
