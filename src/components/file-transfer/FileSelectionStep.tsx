import { FolderOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "../FileDropzone";
import { FixedActionBar } from "../FixedActionBar";

interface FileSelectionStepProps {
  contentVersionPath: string;
  contentDocumentLinkPath: string;
  contentVersionFolderPath: string;
  isProcessing: boolean;
  onContentVersionPathChange: (path: string) => void;
  onContentDocumentLinkPathChange: (path: string) => void;
  onContentVersionFolderPathChange: (path: string) => void;
  onAnalyze: () => void;
  onBack: () => void;
}

export const FileSelectionStep = ({
  contentVersionPath,
  contentDocumentLinkPath,
  contentVersionFolderPath,
  isProcessing,
  onContentVersionPathChange,
  onContentDocumentLinkPathChange,
  onContentVersionFolderPathChange,
  onAnalyze,
  onBack,
}: FileSelectionStepProps) => {
  return (
    <div className="space-y-8 pb-24">
      <Card className="border border-gray-200 shadow-sm rounded-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FolderOpen className="h-5 w-5 text-blue-600" />
            ファイル選択
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <FileDropzone
              label="ContentVersion.csv"
              value={contentVersionPath}
              onFileSelect={onContentVersionPathChange}
              disabled={isProcessing}
              placeholder="ファイル情報のCSVファイル"
            />
            <FileDropzone
              label="ContentDocumentLink.csv"
              value={contentDocumentLinkPath}
              onFileSelect={onContentDocumentLinkPathChange}
              disabled={isProcessing}
              placeholder="リンク情報のCSVファイル"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              ContentVersion フォルダパス
            </Label>
            <Input
              type="text"
              value={contentVersionFolderPath}
              onChange={(e) => onContentVersionFolderPathChange(e.target.value)}
              placeholder="/path/to/ContentVersion/folder"
              disabled={isProcessing}
              className="h-11"
            />
          </div>
        </CardContent>
      </Card>

      <FixedActionBar
        leftButton={{
          label: "戻る",
          onClick: onBack,
          disabled: isProcessing,
        }}
        rightButton={{
          label: "オブジェクト分析",
          onClick: onAnalyze,
          disabled:
            isProcessing || !contentVersionPath || !contentDocumentLinkPath,
          loading: isProcessing,
        }}
        centerContent={
          contentVersionPath && contentDocumentLinkPath
            ? "ファイル選択完了"
            : "ファイルを選択してください"
        }
      />
    </div>
  );
};
