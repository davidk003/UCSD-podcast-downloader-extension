export interface KalturaInfo {
  entryId: string;
  partnerId: string;
  ks: string | null;
}

/**
 * Extract Kaltura video information from the podcast page HTML and return
 * video id, account id and session token in interface object
 */
async function getInfo(html: string): Promise<KalturaInfo | null> {
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

  return {
    entryId: entryIdMatch[1],
    partnerId: partnerIdMatch[1],
    ks: ksMatch ? ksMatch[1] : null,
  };
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
  return `https://cdnapisec.kaltura.com/api_v3/index.php?service=caption_captionasset&apiVersion=3.1&expiry=86400&clientTag=kwidget:v2.101&format=1&ignoreNull=1&action=list&filter:objectType=KalturaAssetFilter&filter:entryIdEqual=${
    info.entryId
  }&filter:statusEqual=2&pager:pageSize=50&ks=${info.ks || ""}`;
}

/**
 * Extracts Kaltura info from HTML and returns constructed URLs.
 * Validates that necessary fields are present.
 */
export async function extractKalturaUrls(html: string): Promise<{
  videoUrl: string;
  subtitleUrl: string | null;
} | null> {
  try {
    const info = await getInfo(html);

    if (!info) {
      // getInfo already logs error
      return null;
    }

    // Validation: Check for essential fields
    if (!info.entryId || !info.partnerId) {
      console.error("Invalid Kaltura Info: Missing entryId or partnerId");
      return null;
    }

    const videoUrl = await constructVideoUrl(info);

    let subtitleUrl: string | null = null;
    if (info.ks) {
      subtitleUrl = await constructSubtitleUrl(info);
    } else {
      console.warn("No KS token available, cannot construct subtitle API URL");
    }

    return {
      videoUrl,
      subtitleUrl,
    };
  } catch (error) {
    console.error("Error extracting Kaltura URLs:", error);
    return null;
  }
}
