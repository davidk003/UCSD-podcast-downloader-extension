export interface KalturaInfo {
  entryId: string;
  partnerId: string;
  ks: string | null;
}

export interface SubtitleInfo {
  id: string;
  language: string;
  languageCode: string;
  label: string;
  src: string;
}

/**
 * Extract Kaltura video information from the podcast page HTML and return
 * video id, account id and session token in interface object
 */
async function getInfo(html: string): Promise<[KalturaInfo, SubtitleInfo[]] | null> {
  // Extract entry_id (video identifier)
  const entryIdMatch: string[] | null = html.match(
    /entry_id['":\s=]+([a-zA-Z0-9_-]+)/
  );

  // Extract partner_id (Kaltura account ID)
  const partnerIdMatch: string[] | null = html.match(/\/p\/(\d+)\//);

  // Extract KS token (Kaltura Session temp auth token?)
  const ksMatch: string[] | null = html.match(/ks['":\s=]+([a-zA-Z0-9_-]+)/);

  // Note: scrape.ts did not strictly require ksMatch to be present for the function to return
  if (!entryIdMatch || !partnerIdMatch) {
    console.error("Failed to extract required Kaltura configuration");
    return null;
  }
  const kInfo: KalturaInfo = {
    entryId: entryIdMatch[1],
    partnerId: partnerIdMatch[1],
    ks: ksMatch ? ksMatch[1] : null,
  };

  const subtitleInfo: SubtitleInfo[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const subtitleElements = doc.querySelectorAll('track');
  subtitleElements.forEach((element) => {
    const id = element.getAttribute('id');
    const language = element.getAttribute('language');
    const languageCode = element.getAttribute('languageCode');
    const label = element.getAttribute('label');
    const src = element.getAttribute('src');
    if (!id || !language || !languageCode || !label || !src) {
      console.error("Failed to extract subtitle information, one or more attributes are missing");
      return;
    }
    subtitleInfo.push({ id, language, languageCode, label, src });
  });

  return [kInfo, subtitleInfo];
}

/**
 * Construct the direct download URL using Kaltura's playManifest API
 */
async function constructVideoUrl(info: KalturaInfo): Promise<string> {
  let apiUrl = `https://cdnapisec.kaltura.com/p/${info.partnerId}/sp/${info.partnerId}00/playManifest/entryId/${info.entryId}/format/download/protocol/https`;

  if (info.ks) {
    apiUrl += `/ks/${info.ks}`;
  }
  return apiUrl;
}

/**
 * Construct the API URL for retrieving subtitle information
 */
async function constructSubtitleUrl(info: KalturaInfo): Promise<string> {
  return `https://cdnapisec.kaltura.com/api_v3/index.php?service=caption_captionasset&apiVersion=3.1&expiry=86400&clientTag=kwidget:v2.101&format=1&ignoreNull=1&action=list&filter:objectType=KalturaAssetFilter&filter:entryIdEqual=${info.entryId
    }&filter:statusEqual=2&pager:pageSize=50&ks=${info.ks || ""}`;
}

/**
 * Extracts Kaltura info from HTML and returns constructed URLs.
 * Validates that necessary fields are present.
 */
export async function extractKalturaUrls(html: string): Promise<{
  videoUrl: string;
  subtitleTracks: SubtitleInfo[] | null;
} | null> {
  try {
    const info = await getInfo(html);

    if (!info) {
      return null;
    }

    // Validation: Check kalturainfo for essential fields
    if (!info[0].entryId || !info[0].partnerId) {
      console.error("Invalid Kaltura Info: Missing entryId or partnerId");
      return null;
    }
    const videoUrl = await constructVideoUrl(info[0]);
    if (info[1].length === 0) {
      console.error("No subtitle information found");
    }

    return {
      videoUrl,
      subtitleTracks: info[1] || null,
    };
  } catch (error) {
    console.error("Error extracting Kaltura URLs:", error);
    return null;
  }
}
