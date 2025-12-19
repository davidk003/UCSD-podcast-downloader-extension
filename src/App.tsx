import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, FileCode2 } from "lucide-react";

export default function ExtensionPopup() {
  const [htmlExtracted, setHtmlExtracted] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [extractedHtml, setExtractedHtml] = useState<string>("");

  const handleExtractHtml = async () => {
    setIsExtracting(true);
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab.id) {
      return;
    }
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.documentElement.outerHTML,
    });
    if (!result || !result[0] || !result[0].result) {
      return;
    }
    setExtractedHtml(result[0].result);
    console.log(result[0].result);
    console.log(extractedHtml);

    setHtmlExtracted(true);
    setIsExtracting(false);
  };

  const handleDownloadVideo = async () => {
    setIsDownloading(true);
    setDownloadProgress(0);

    // Simulate video download with progress
    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsDownloading(false);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 to-blue-50 p-4 dark:from-slate-950 dark:to-sky-950">
      <Card className="w-full max-w-sm border-sky-200 shadow-lg dark:border-sky-900">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-sky-900 dark:text-sky-100">
            UCSD Podcast Downloader
          </CardTitle>
          <CardDescription>
            First extract details from the page, then click download to start
            the download!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleExtractHtml}
            disabled={isExtracting || htmlExtracted}
            className="w-full"
            size="lg"
          >
            <FileCode2 className="mr-2 size-5" />
            {isExtracting
              ? "Extracting..."
              : htmlExtracted
              ? "HTML Extracted"
              : "Extract HTML"}
          </Button>

          <Button
            onClick={handleDownloadVideo}
            disabled={!htmlExtracted || isDownloading}
            variant={htmlExtracted ? "default" : "secondary"}
            className="w-full"
            size="lg"
          >
            <Download className="mr-2 size-5" />
            {isDownloading ? "Downloading..." : "Download Video"}
          </Button>

          {isDownloading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Download Progress</span>
                <span className="font-medium text-sky-700 dark:text-sky-300">
                  {downloadProgress}%
                </span>
              </div>
              <Progress value={downloadProgress} className="h-3" />
            </div>
          )}

          {htmlExtracted && !isDownloading && downloadProgress === 0 && (
            <div className="rounded-lg bg-sky-100 p-3 dark:bg-sky-950/50">
              <p className="text-sm text-sky-800 dark:text-sky-200">
                HTML extracted successfully! Click Download Video to continue.
              </p>
            </div>
          )}

          {downloadProgress === 100 && (
            <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-950/50">
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                Video downloaded successfully!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
