import { describe, expect, test } from "vitest";
import { extractKalturaUrls } from "../src/lib/kaltura.ts";

async function readFixture(name: string): Promise<string> {
  const response = await fetch(`/tests/${name}`);
  if (!response.ok) {
    throw new Error(`Failed to load fixture ${name}: ${response.status}`);
  }
  return response.text();
}

describe("Kaltura browser parsing", () => {
  test("extracts a valid Kaltura video URL from saved UCSD fixture", async () => {
    const html = await readFixture("cse11.html");
    const result = await extractKalturaUrls(html);

    expect(result).not.toBeNull();
    expect(result?.videoUrl).toContain("https://cdnapisec.kaltura.com");
    expect(result?.videoUrl).toContain("/entryId/1_2cvaf88b/");
    expect(result?.subtitleTracks).toEqual([]);
  });

  test("extracts subtitle track metadata when tracks exist", async () => {
    const html = await readFixture("cse11-with-tracks.html");
    const result = await extractKalturaUrls(html);

    expect(result).not.toBeNull();
    expect(result?.subtitleTracks?.length).toBe(2);
    expect(result?.subtitleTracks?.[0]?.label).toBe("English");
    expect(result?.subtitleTracks?.[1]?.label).toBe("Spanish");
  });

  test.skip("runs client-side passthrough processing with a local blob input", async () => {
    // Reserved for real ffmpeg.wasm browser integration once worker loading is
    // stable in the vitest browser runtime for this project.
  });
});
