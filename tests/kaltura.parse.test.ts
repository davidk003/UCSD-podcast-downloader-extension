import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { extractKalturaUrls } from "../src/lib/kaltura.ts";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);

function readFixture(name: string): string {
  return readFileSync(path.join(currentDir, name), "utf8");
}

describe("Kaltura HTML parsing", () => {
  test("extracts Kaltura video URL from cse11 fixture", async () => {
    const html = readFixture("cse11.html");
    const result = await extractKalturaUrls(html);

    expect(result).not.toBeNull();
    expect(result?.videoUrl).toContain("https://cdnapisec.kaltura.com");
    expect(result?.videoUrl).toContain("/p/2323111/");
    expect(result?.videoUrl).toContain("/entryId/1_2cvaf88b/");
    expect(result?.videoUrl).toContain("/ks/");
    expect(result?.subtitleTracks).toEqual([]);
  });

  test("extracts subtitle tracks when track tags are present", async () => {
    const html = readFixture("cse11-with-tracks.html");
    const result = await extractKalturaUrls(html);

    expect(result).not.toBeNull();
    expect(result?.subtitleTracks).not.toBeNull();
    expect(result?.subtitleTracks).toHaveLength(2);

    expect(result?.subtitleTracks?.[0]).toMatchObject({
      id: "captions-en",
      language: "English",
      languageCode: "en",
      label: "English",
    });

    expect(result?.subtitleTracks?.[1]).toMatchObject({
      id: "captions-es",
      language: "Spanish",
      languageCode: "es",
      label: "Spanish",
    });
  });

  test("parses alternate saved fixture consistently", async () => {
    const cse11 = await extractKalturaUrls(readFixture("cse11.html"));
    const alt = await extractKalturaUrls(readFixture("test.html"));

    expect(cse11).not.toBeNull();
    expect(alt).not.toBeNull();
    expect(cse11?.videoUrl).toContain("/entryId/1_2cvaf88b/");
    expect(alt?.videoUrl).toContain("/entryId/1_2cvaf88b/");
    expect(cse11?.videoUrl).toContain("/p/2323111/");
    expect(alt?.videoUrl).toContain("/p/2323111/");
  });

  test("returns null for HTML with no Kaltura data", async () => {
    const html = readFixture("empty-page.html");
    const result = await extractKalturaUrls(html);

    expect(result).toBeNull();
  });

  test("returns null when partner id is missing", async () => {
    const html = readFixture("partial-kaltura.html");
    const result = await extractKalturaUrls(html);

    expect(result).toBeNull();
  });

  test("omits ks from video URL when ks token does not match expected pattern", async () => {
    const html = `
      <html>
        <head>
          <script src="https://cdnapi.kaltura.com/p/2323111/sp/232311100/embedIframeJs"></script>
          <script>
            kWidget.embed({
              entry_id: '1_abc123xy',
              ks: '+invalid-token'
            });
          </script>
        </head>
        <body></body>
      </html>
    `;

    const result = await extractKalturaUrls(html);

    expect(result).not.toBeNull();
    expect(result?.videoUrl).toContain("/entryId/1_abc123xy/");
    expect(result?.videoUrl).not.toContain("/ks/");
  });

  test("uses the first entry_id match when multiple are present", async () => {
    const html = `
      <html>
        <head>
          <script src="https://cdnapi.kaltura.com/p/2323111/sp/232311100/embedIframeJs"></script>
          <script>
            const first = { entry_id: '1_firstEntry', ks: 'abc123' };
            const second = { entry_id: '1_secondEntry', ks: 'def456' };
          </script>
        </head>
        <body></body>
      </html>
    `;

    const result = await extractKalturaUrls(html);

    expect(result).not.toBeNull();
    expect(result?.videoUrl).toContain("/entryId/1_firstEntry/");
    expect(result?.videoUrl).not.toContain("/entryId/1_secondEntry/");
  });
});

describe("Kaltura fixture sanity checks", () => {
  test("cse11 fixture contains expected lecture links", () => {
    const html = readFixture("cse11.html");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const lectureLinks = Array.from(doc.querySelectorAll("a.video.match"));

    expect(lectureLinks.length).toBe(19);
    expect(lectureLinks[0]?.getAttribute("href")).toContain(
      "https://podcast.ucsd.edu/watch/fa25/cse11_a00/1"
    );
    expect(lectureLinks[18]?.getAttribute("href")).toContain(
      "https://podcast.ucsd.edu/watch/fa25/cse11_a00/19"
    );
  });
});
