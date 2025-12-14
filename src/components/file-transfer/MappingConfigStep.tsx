import { AlertTriangle, Info, Settings2 } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DEFAULT_CUSTOM_OBJECT_PROPERTY,
  DEFAULT_SALESFORCE_PROPERTIES,
} from "@/constants/salesforce";
import type { ObjectGroup } from "@/hooks/useCsvAnalysis";
import { FixedActionBar } from "../FixedActionBar";

interface MappingConfigStepProps {
  objectGroups: ObjectGroup[];
  objectMapping: Record<string, string>;
  salesforceProperties: Record<string, string>;
  hubspotObjectOptions: Array<{ value: string; label: string }>;
  hubspotPortalId: string;
  isMapping: boolean;
  onMappingChange: (prefix: string, hubspotObject: string) => void;
  onPropertyChange: (prefix: string, property: string) => void;
  onExecute: () => void;
  onBack: () => void;
}

export const MappingConfigStep = ({
  objectGroups,
  objectMapping,
  salesforceProperties,
  hubspotObjectOptions,
  hubspotPortalId,
  isMapping,
  onMappingChange,
  onPropertyChange,
  onExecute,
  onBack,
}: MappingConfigStepProps) => {
  const [showOnlyMapped, setShowOnlyMapped] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [portalIdInput, setPortalIdInput] = useState("");

  const mappedCount = Object.values(objectMapping).filter(
    (v) => v !== "none",
  ).length;

  const handleConfirmExecute = () => {
    setShowConfirmDialog(false);
    setPortalIdInput("");
    onExecute();
  };

  return (
    <div className="space-y-8 pb-24">
      <Card className="border shadow-sm rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Settings2 className="h-5 w-5 text-primary" />
                マッピング設定
              </CardTitle>
              <p className="text-muted-foreground text-sm mt-1">
                ContentDocumentLink.csvからオブジェクトごとの関連添付ファイルレコード数を取得しました。
                <br />
                マッピングするオブジェクトを選択してください。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-mapped"
                checked={showOnlyMapped}
                onCheckedChange={setShowOnlyMapped}
              />
              <label
                htmlFor="show-mapped"
                className="text-sm font-medium cursor-pointer"
              >
                マッピング済のみ
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <TooltipProvider>
            <div className="grid md:grid-cols-2 gap-4 pb-2 border-b">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                マッピングするHubSpotオブジェクト
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      Salesforceオブジェクトに対応するHubSpotオブジェクトを選択
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                HubSpotプロパティ内部値
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      SalesforceのIDが格納されるHubSpotプロパティの内部値
                      <br />
                      このプロパティでHubSpotのレコードの存在確認を行います。
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            {objectGroups
              .filter(
                (group) =>
                  !showOnlyMapped || objectMapping[group.prefix] !== "none",
              )
              .map((group) => (
                <div
                  key={group.prefix}
                  className="bg-muted/30 rounded-md p-4 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm bg-primary text-primary-foreground px-3 py-1 rounded-full">
                      {group.prefix}
                    </span>
                    <span className="font-medium">{group.objectName}</span>
                    <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                      {group.count.toLocaleString()}件
                    </span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Select
                      value={objectMapping[group.prefix] || ""}
                      onValueChange={(value) =>
                        onMappingChange(group.prefix, value)
                      }
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {hubspotObjectOptions.map((obj) => (
                          <SelectItem key={obj.value} value={obj.value}>
                            {obj.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {objectMapping[group.prefix] !== "none" ? (
                      <Input
                        value={salesforceProperties[group.prefix] || ""}
                        onChange={(e) =>
                          onPropertyChange(group.prefix, e.target.value)
                        }
                        placeholder={
                          (objectMapping[group.prefix] &&
                            DEFAULT_SALESFORCE_PROPERTIES[
                              objectMapping[group.prefix]
                            ]) ||
                          DEFAULT_CUSTOM_OBJECT_PROPERTY
                        }
                        className="h-10"
                      />
                    ) : (
                      <div className="h-10" />
                    )}
                  </div>
                </div>
              ))}
          </TooltipProvider>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              ファイルマッピング実行の確認
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>以下の処理を実行します：</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>両CSVからマッピング対象レコードを抽出</li>
                <li>HubSpotプロパティでレコード存在確認</li>
                <li>CSVのVersionData(Base64)からファイルをアップロード</li>
                <li>HubSpotレコードにノートを作成</li>
                <li>処理結果CSVを出力</li>
              </ol>
              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium">
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
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPortalIdInput("")}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmExecute}
              disabled={portalIdInput !== hubspotPortalId}
            >
              実行する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FixedActionBar
        leftButton={{
          label: "戻る",
          onClick: onBack,
        }}
        rightButton={{
          label: "ファイルマッピング実行",
          onClick: () => setShowConfirmDialog(true),
          disabled:
            isMapping ||
            Object.values(objectMapping).every((v) => v === "none"),
          loading: isMapping,
        }}
      />
    </div>
  );
};
