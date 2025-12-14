import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { toast } from "sonner";
import {
  DEFAULT_CUSTOM_OBJECT_PROPERTY,
  DEFAULT_MAPPING,
  DEFAULT_SALESFORCE_PROPERTIES,
  MAPPING_PRIORITY,
  SALESFORCE_OBJECTS,
} from "@/constants/salesforce";

export interface ObjectGroup {
  prefix: string;
  count: number;
  objectName: string;
}

export const useCsvAnalysis = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [objectGroups, setObjectGroups] = useState<ObjectGroup[]>([]);

  const analyzeFiles = async (
    contentVersionPath: string,
    contentDocumentLinkPath: string,
  ) => {
    if (!contentVersionPath.trim() || !contentDocumentLinkPath.trim()) {
      toast.error("両方のファイルを選択してください");
      return null;
    }

    setIsProcessing(true);
    toast.loading("オブジェクトを分析中...");

    try {
      const result = (await invoke("analyze_csv_files", {
        contentVersionPath,
        contentDocumentLinkPath,
      })) as { object_groups: Record<string, number> };

      const groups: ObjectGroup[] = Object.entries(result.object_groups)
        .map(([prefix, count]) => ({
          prefix,
          count: count as number,
          objectName: SALESFORCE_OBJECTS[prefix] || "カスタムオブジェクト",
        }))
        .sort((a, b) => {
          const aPriority = MAPPING_PRIORITY.indexOf(a.prefix);
          const bPriority = MAPPING_PRIORITY.indexOf(b.prefix);
          if (aPriority !== -1 && bPriority !== -1)
            return aPriority - bPriority;
          if (aPriority !== -1) return -1;
          if (bPriority !== -1) return 1;
          return b.count - a.count;
        });

      setObjectGroups(groups);
      toast.success(`${groups.length}種類のオブジェクトを検出しました`);

      // デフォルトマッピングを返す
      const initialMapping: Record<string, string> = {};
      const initialProperties: Record<string, string> = {};

      groups.forEach((group) => {
        initialMapping[group.prefix] = DEFAULT_MAPPING[group.prefix] || "none";
        const mappedObject = DEFAULT_MAPPING[group.prefix];
        initialProperties[group.prefix] =
          mappedObject && DEFAULT_SALESFORCE_PROPERTIES[mappedObject]
            ? DEFAULT_SALESFORCE_PROPERTIES[mappedObject]
            : DEFAULT_CUSTOM_OBJECT_PROPERTY;
      });

      return { groups, initialMapping, initialProperties };
    } catch (error) {
      toast.error(`エラー: ${error}`);
      return null;
    } finally {
      toast.dismiss();
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    objectGroups,
    analyzeFiles,
  };
};
