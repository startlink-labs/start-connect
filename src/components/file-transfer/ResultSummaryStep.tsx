import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ObjectSummary } from "@/hooks/useFileMapping";
import { FixedActionBar } from "../FixedActionBar";

interface ResultSummaryStepProps {
  summaries: ObjectSummary[];
  resultCsvPath: string | null;
  downloadCompleted: boolean;
  onReset: () => void;
  onDownloadComplete?: () => void;
  isChatterMigration?: boolean;
}

export const ResultSummaryStep = ({
  summaries,
  resultCsvPath,
  downloadCompleted,
  onReset,
  onDownloadComplete,
  isChatterMigration = false,
}: ResultSummaryStepProps) => {
  const handleDownload = async () => {
    if (!resultCsvPath) {
      toast.error("結果ファイルが見つかりません");
      return;
    }

    const savePath = await save({
      defaultPath: `hubspot_upload_result_${new Date().toISOString().split("T")[0]}.csv`,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });

    if (savePath) {
      try {
        await invoke("save_result_csv", {
          tempPath: resultCsvPath,
          savePath,
        });
        toast.success("CSVファイルを保存しました");
        onDownloadComplete?.();
      } catch (error) {
        toast.error(`保存エラー: ${error}`);
      }
    }
  };

  return (
    <div className="space-y-8 pb-24">
      <Card className="border shadow-sm rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Download className="h-5 w-5 text-primary" />
            結果サマリー
          </CardTitle>
          <p className="text-muted-foreground text-sm mt-1">
            オブジェクトごとの処理結果を表示しています
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {summaries.map((summary) => {
            const total =
              summary.success_count +
              summary.skipped_count +
              summary.error_count;
            return (
              <div
                key={summary.prefix}
                className="bg-muted/30 rounded-lg p-4 border"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-full font-medium">
                      {summary.prefix}
                    </span>
                    <span className="font-semibold">
                      {summary.hubspot_object}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground font-medium">
                    合計: {total}件
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-background rounded-md p-3 text-center border border-primary/20">
                    <div className="text-2xl font-bold text-primary">
                      {summary.success_count}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      成功
                    </div>
                  </div>
                  <div className="bg-background rounded-md p-3 text-center border border-secondary/20">
                    <div className="text-2xl font-bold text-secondary">
                      {summary.skipped_count}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      スキップ
                    </div>
                  </div>
                  <div className="bg-background rounded-md p-3 text-center border border-destructive/20">
                    <div className="text-2xl font-bold text-destructive">
                      {summary.error_count}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      エラー
                    </div>
                  </div>
                  <div className="bg-background rounded-md p-3 text-center border border-accent/20">
                    <div className="text-2xl font-bold text-accent">
                      {summary.uploaded_files}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {isChatterMigration ? "ノート作成数" : "ファイル数"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <FixedActionBar
        leftButton={{
          label: "最初から",
          onClick: onReset,
        }}
        rightButton={{
          label: downloadCompleted ? "ダウンロード済み" : "CSVダウンロード",
          onClick: handleDownload,
          disabled: downloadCompleted,
        }}
      />
    </div>
  );
};
