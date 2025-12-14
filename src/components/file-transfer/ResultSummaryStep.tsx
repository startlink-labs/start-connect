import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ObjectSummary } from "@/hooks/useFileMapping";
import { FixedActionBar } from "../FixedActionBar";

interface ResultSummaryStepProps {
  summaries: ObjectSummary[];
  resultCsvPath: string | null;
  onReset: () => void;
}

export const ResultSummaryStep = ({
  summaries,
  resultCsvPath,
  onReset,
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
      } catch (error) {
        toast.error(`保存エラー: ${error}`);
      }
    }
  };

  return (
    <div className="space-y-8 pb-24">
      <Card className="border border-gray-200 shadow-sm rounded-lg">
        <CardHeader>
          <CardTitle className="text-xl">処理結果</CardTitle>
          <p className="text-gray-600 text-sm mt-1">
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
                className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm bg-blue-600 text-white px-3 py-1.5 rounded-full font-medium">
                      {summary.prefix}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {summary.hubspot_object}
                    </span>
                  </div>
                  <span className="text-sm text-gray-600 font-medium">
                    合計: {total}件
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-white rounded-md p-3 text-center border border-green-200">
                    <div className="text-2xl font-bold text-green-600">
                      {summary.success_count}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">成功</div>
                  </div>
                  <div className="bg-white rounded-md p-3 text-center border border-yellow-200">
                    <div className="text-2xl font-bold text-yellow-600">
                      {summary.skipped_count}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">スキップ</div>
                  </div>
                  <div className="bg-white rounded-md p-3 text-center border border-red-200">
                    <div className="text-2xl font-bold text-red-600">
                      {summary.error_count}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">エラー</div>
                  </div>
                  <div className="bg-white rounded-md p-3 text-center border border-blue-200">
                    <div className="text-2xl font-bold text-blue-600">
                      {summary.uploaded_files}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">ファイル</div>
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
          label: "CSVダウンロード",
          onClick: handleDownload,
        }}
        centerContent="処理完了"
      />
    </div>
  );
};
