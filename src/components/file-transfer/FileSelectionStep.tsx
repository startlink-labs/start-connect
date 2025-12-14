import { FolderOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDropzone } from "../FileDropzone";
import { FixedActionBar } from "../FixedActionBar";

interface FileSelectionStepProps {
  contentVersionPath: string;
  contentDocumentLinkPath: string;
  isProcessing: boolean;
  onContentVersionPathChange: (path: string) => void;
  onContentDocumentLinkPathChange: (path: string) => void;
  onAnalyze: () => void;
  onBack: () => void;
}

export const FileSelectionStep = ({
  contentVersionPath,
  contentDocumentLinkPath,
  isProcessing,
  onContentVersionPathChange,
  onContentDocumentLinkPathChange,
  onAnalyze,
  onBack,
}: FileSelectionStepProps) => {
  return (
    <div className="space-y-8 pb-24">
      <Card className="border shadow-sm rounded-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FolderOpen className="h-5 w-5 text-primary" />
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
      />
    </div>
  );
};
