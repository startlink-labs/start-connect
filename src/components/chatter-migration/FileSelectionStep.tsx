import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDropzone } from "../FileDropzone";
import { FixedActionBar } from "../FixedActionBar";

interface FileSelectionStepProps {
  feedItemPath: string;
  feedCommentPath: string;
  userPath: string;
  contentVersionPath: string;
  contentDocumentLinkPath: string;
  feedAttachmentPath: string;
  isProcessing: boolean;
  onFeedItemPathChange: (path: string) => void;
  onFeedCommentPathChange: (path: string) => void;
  onUserPathChange: (path: string) => void;
  onContentVersionPathChange: (path: string) => void;
  onContentDocumentLinkPathChange: (path: string) => void;
  onFeedAttachmentPathChange: (path: string) => void;
  onAnalyze: () => void;
  onBack: () => void;
}

export const FileSelectionStep = ({
  feedItemPath,
  feedCommentPath,
  userPath,
  contentVersionPath,
  contentDocumentLinkPath,
  feedAttachmentPath,
  isProcessing,
  onFeedItemPathChange,
  onFeedCommentPathChange,
  onUserPathChange,
  onContentVersionPathChange,
  onContentDocumentLinkPathChange,
  onFeedAttachmentPathChange,
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
          <FileDropzone
            label="User.csv（オプション）"
            value={userPath}
            onFileSelect={onUserPathChange}
            disabled={isProcessing}
            placeholder="ユーザー情報のCSVファイル（指定しない場合、投稿者はIDで表示されます）"
          />
          <div className="grid md:grid-cols-2 gap-6">
            <FileDropzone
              label="ContentVersion.csv（オプション）"
              value={contentVersionPath}
              onFileSelect={onContentVersionPathChange}
              disabled={isProcessing}
              placeholder="添付ファイル情報のCSVファイル"
            />
            <FileDropzone
              label="ContentDocumentLink.csv（オプション）"
              value={contentDocumentLinkPath}
              onFileSelect={onContentDocumentLinkPathChange}
              disabled={isProcessing}
              placeholder="ファイルリンク情報のCSVファイル"
            />
          </div>
          <FileDropzone
            label="FeedAttachment.csv（オプション）"
            value={feedAttachmentPath}
            onFileSelect={onFeedAttachmentPathChange}
            disabled={isProcessing}
            placeholder="古い形式の添付ファイル情報（FeedItemのみ）"
          />
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
