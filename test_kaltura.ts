import { extractKalturaUrls } from "./src/lib/kaltura";
import fs from "fs";

const mockFile = "./cse11.html";
const mockHtml = fs.readFileSync(mockFile, "utf-8");

async function run() {
  console.log("Testing extractKalturaUrls...");
  const result = await extractKalturaUrls(mockHtml);

  if (result) {
    console.log("Success!");
    console.log("Video URL:", result.videoUrl);
    console.log("Subtitle URL:", result.subtitleUrl);
  } else {
    console.error("Test Failed: Returned null");
  }
}

run();
