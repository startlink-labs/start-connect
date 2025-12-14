import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { PortalIdConfirmInput } from "@/components/PortalIdConfirmInput";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";

interface ExecutionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  steps: string[];
  mappedCount: number;
  hubspotPortalId: string;
  onConfirm: () => void;
}

export const ExecutionConfirmDialog = ({
  open,
  onOpenChange,
  title,
  steps,
  mappedCount,
  hubspotPortalId,
  onConfirm,
}: ExecutionConfirmDialogProps) => {
  const [portalIdInput, setPortalIdInput] = useState("");

  const handleConfirm = () => {
    setPortalIdInput("");
    onConfirm();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPortalIdInput("");
    }
    onOpenChange(newOpen);
  };

  const handleCancel = () => {
    setPortalIdInput("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            以下の処理を実行します。確認のためポータルIDを入力してください。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 text-sm">
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium text-foreground">
              マッピング対象: {mappedCount}件
            </p>
            <div className="space-y-2">
              <Label htmlFor="portal-id-confirm" className="text-sm">
                確認のため、HubSpotポータルIDを入力してください
              </Label>
              <PortalIdConfirmInput
                expectedValue={hubspotPortalId}
                value={portalIdInput}
                onChange={setPortalIdInput}
              />
            </div>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            キャンセル
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={portalIdInput !== hubspotPortalId}
          >
            実行する
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
