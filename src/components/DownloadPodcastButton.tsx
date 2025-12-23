import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ProgressLog } from "@/components/ProgressLog";
import { Download, Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  extractHtml,
  processHtml,
  downloadVideo,
  type LogEntry,
} from "@/lib/handlers";

type Stage =
  | "idle"
  | "extracting"
  | "processing"
  | "downloading"
  | "complete"
  | "error";

const stageLabels: Record<Stage, string> = {
  idle: "Download Podcast",
  extracting: "Extracting page...",
  processing: "Processing...",
  downloading: "Downloading...",
  complete: "Download Complete!",
  error: "Failed - Click to Retry",
};

export function DownloadPodcastButton() {
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback(
    (message: string, type: LogEntry["type"] = "info") => {
      setLogs((prev) => [...prev, { timestamp: new Date(), message, type }]);
    },
    []
  );

  const handleClick = useCallback(async () => {
    // Reset state for new attempt
    if (stage === "complete" || stage === "error") {
      setStage("idle");
      setProgress(0);
      setLogs([]);
      return;
    }

    // Don't allow clicks while running
    if (stage !== "idle") return;

    try {
      // Stage 1: Extract HTML
      setStage("extracting");
      addLog("Extracting HTML from page...", "info");
      const html = await extractHtml();
      addLog("HTML extracted successfully", "success");

      // Stage 2: Process HTML
      setStage("processing");
      addLog("Processing Kaltura video info...", "info");
      const { videoUrl, subtitleUrl } = await processHtml(html);
      addLog(`Video URL found`, "success");
      if (subtitleUrl) {
        addLog(`Subtitle URL found`, "success");
      }

      // Stage 3: Download
      setStage("downloading");
      setProgress(0);
      addLog("Starting download...", "info");

      await downloadVideo(videoUrl, (p) => {
        setProgress(p);
      });

      addLog("Download complete!", "success");
      setStage("complete");
      setProgress(100);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      addLog(message, "error");
      setStage("error");
    }
  }, [stage, addLog]);

  const isRunning = ["extracting", "processing", "downloading"].includes(stage);
  const showProgress = stage === "downloading" || stage === "complete";

  const getIcon = () => {
    if (isRunning) return <Loader2 className="mr-2 size-5 animate-spin" />;
    if (stage === "complete")
      return <CheckCircle2 className="mr-2 size-5 text-emerald-500" />;
    if (stage === "error")
      return <XCircle className="mr-2 size-5 text-red-500" />;
    return <Download className="mr-2 size-5" />;
  };

  const getVariant = () => {
    if (stage === "complete") return "secondary" as const;
    if (stage === "error") return "destructive" as const;
    return "default" as const;
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={handleClick}
        disabled={isRunning}
        variant={getVariant()}
        className="w-full"
        size="lg"
      >
        {getIcon()}
        {stageLabels[stage]}
      </Button>

      {showProgress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Download Progress</span>
            <span className="font-medium text-sky-700 dark:text-sky-300">
              {progress}%
            </span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>
      )}

      <ProgressLog logs={logs} />
    </div>
  );
}
