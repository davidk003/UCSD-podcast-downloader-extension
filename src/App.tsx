import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DownloadPodcastButton } from "@/components/DownloadPodcastButton";

export default function ExtensionPopup() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 to-blue-50 p-4 dark:from-slate-950 dark:to-sky-950">
      <Card className="w-full max-w-sm border-sky-200 shadow-lg dark:border-sky-900">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-sky-900 dark:text-sky-100">
            UCSD Podcast Downloader
          </CardTitle>
          <CardDescription>
            Click the button below to extract and download the podcast from this
            page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DownloadPodcastButton />
        </CardContent>
      </Card>
    </div>
  );
}
