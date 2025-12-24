import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { toast } from "sonner";
import type { ObjectSummary } from "./useFileMapping";

export const useChatterMigration = () => {
  const [isMigrating, setIsMigrating] = useState(false);
  const [resultCsvPath, setResultCsvPath] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<ObjectSummary[]>([]);

  const processChatterMigration = async (
    feedItemPath: string,
    feedCommentPath: string,
    userPath: string,
    contentVersionPath: string,
    contentDocumentLinkPath: string,
    feedAttachmentPath: string,
    mappings: Record<
      string,
      { hubspot_object: string; salesforce_property: string }
    >,
  ) => {
    setIsMigrating(true);
    toast.loading("Chatter移行を開始しています...");

    try {
      const result = (await invoke("process_chatter_migration", {
        feedItemPath,
        feedCommentPath,
        userPath,
        contentVersionPath,
        contentDocumentLinkPath,
        feedAttachmentPath,
        objectMappings: mappings,
      })) as {
        result_csv_path: string;
        summaries: ObjectSummary[];
      };

      setResultCsvPath(result.result_csv_path);
      setSummaries(result.summaries);
      toast.success("Chatter移行が完了しました");
      return result;
    } catch (error) {
      toast.error(`エラー: ${error}`);
      throw error;
    } finally {
      toast.dismiss();
      setIsMigrating(false);
    }
  };

  const reset = () => {
    setResultCsvPath(null);
    setSummaries([]);
  };

  return {
    isMigrating,
    resultCsvPath,
    summaries,
    processChatterMigration,
    reset,
  };
};
