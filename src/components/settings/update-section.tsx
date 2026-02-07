"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useUpdateChecker } from "@/hooks/use-update-checker";
import { isTauri } from "@/lib/desk";

export function UpdateSection() {
  const { status, updateInfo, error, checkForUpdate, downloadAndInstall, dismiss } = useUpdateChecker();

  // Don't render in browser mode
  if (!isTauri()) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Updates
        </CardTitle>
        <CardDescription>
          Check for new versions of Desk
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "idle" && !error && (
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm">No updates available</p>
              <p className="text-xs text-muted-foreground">You're on the latest version</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => checkForUpdate(true)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Check
            </Button>
          </div>
        )}

        {status === "checking" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking for updates...
          </div>
        )}

        {status === "available" && updateInfo && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <p className="text-sm font-medium">
                Version {updateInfo.version} available
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={downloadAndInstall}>
                Update & Restart
              </Button>
              <Button variant="ghost" size="sm" onClick={dismiss}>
                Later
              </Button>
            </div>
          </div>
        )}

        {status === "downloading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Downloading and installing update...
          </div>
        )}

        {status === "error" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error || "Update check failed"}
            </div>
            <Button variant="outline" size="sm" onClick={() => checkForUpdate(true)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
