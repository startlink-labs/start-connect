import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDropzone } from "../FileDropzone";
import { FixedActionBar } from "../FixedActionBar";

interface FileSelectionStepProps {
  feedItemPath: string;
  feedCommentPath: string;
  isProcessing: boolean;
  onFeedItemPathChange: (path: string) => void;
  onFeedCommentPathChange: (path: string) => void;
  onAnalyze: () => void;
  onBack: () => void;
}

export const FileSelectionStep = ({
  feedItemPath,
  feedCommentPath,
  isProcessing,
  onFeedItemPathChange,
  onFeedCommentPathChange,
  onAnalyze,
  onBack,
}: FileSelectionStepProps) => {
  return (
    <div className="space-y-8 pb-24">
      <Card className="border shadow-sm rounded-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-primary" />
            ファイル選択
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <FileDropzone
              label="FeedItem.csv"
              value={feedItemPath}
              onFileSelect={onFeedItemPathChange}
              disabled={isProcessing}
              placeholder="Chatter投稿のCSVファイル"
            />
            <FileDropzone
              label="FeedComment.csv"
              value={feedCommentPath}
              onFileSelect={onFeedCommentPathChange}
              disabled={isProcessing}
              placeholder="Chatterコメントのcsv"
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
          disabled: isProcessing || !feedItemPath || !feedCommentPath,
          loading: isProcessing,
        }}
      />
    </div>
  );
};
