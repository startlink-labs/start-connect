import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { toast } from "sonner";

export interface ObjectSummary {
  prefix: string;
  hubspot_object: string;
  success_count: number;
  skipped_count: number;
  error_count: number;
  uploaded_files: number;
}

interface FileMappingResult {
  result_csv_path: string;
  summaries: ObjectSummary[];
}

interface ObjectMapping {
  hubspot_object: string;
  salesforce_property: string;
}

export const useFileMapping = () => {
  const [isMapping, setIsMapping] = useState(false);
  const [resultCsvPath, setResultCsvPath] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<ObjectSummary[]>([]);

  const processFileMapping = async (
    contentVersionPath: string,
    contentDocumentLinkPath: string,
    contentVersionFolderPath: string,
    objectMappings: Record<string, ObjectMapping>,
  ) => {
    setIsMapping(true);
    toast.loading("ファイルマッピングを開始中...");

    try {
      const result = (await invoke("process_file_mapping", {
        contentVersionPath,
        contentDocumentLinkPath,
        contentVersionFolderPath,
        objectMappings,
      })) as FileMappingResult;

      setResultCsvPath(result.result_csv_path);
      setSummaries(result.summaries);

      const totalSuccess = result.summaries.reduce(
        (sum, s) => sum + s.success_count,
        0,
      );
      const totalFiles = result.summaries.reduce(
        (sum, s) => sum + s.uploaded_files,
        0,
      );
      toast.success(
        `${totalSuccess}件のレコードを処理し、${totalFiles}個のファイルをアップロードしました`,
      );

      return result;
    } catch (error) {
      toast.error(`エラー: ${error}`);
      throw error;
    } finally {
      toast.dismiss();
      setIsMapping(false);
    }
  };

  const reset = () => {
    setResultCsvPath(null);
    setSummaries([]);
  };

  return {
    isMapping,
    resultCsvPath,
    summaries,
    processFileMapping,
    reset,
  };
};
