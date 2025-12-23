import type { LogEntry } from "@/lib/handlers";

interface ProgressLogProps {
  logs: LogEntry[];
}

const typeStyles = {
  info: "text-sky-700 dark:text-sky-300",
  success: "text-emerald-700 dark:text-emerald-300",
  error: "text-red-700 dark:text-red-300",
  warning: "text-amber-700 dark:text-amber-300",
} as const;

export function ProgressLog({ logs }: ProgressLogProps) {
  if (logs.length === 0) return null;

  return (
    <div className="max-h-32 overflow-y-auto rounded-lg bg-slate-100 p-3 dark:bg-slate-900/50">
      <div className="space-y-1">
        {logs.map((log, index) => (
          <div key={index} className="flex gap-2 text-xs">
            <span className="shrink-0 text-muted-foreground">
              {log.timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            <span className={typeStyles[log.type]}>{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
