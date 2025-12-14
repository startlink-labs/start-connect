import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import type { ObjectGroup } from "@/hooks/useCsvAnalysis";
import { FixedActionBar } from "../FixedActionBar";

interface MappingConfigStepProps {
  objectGroups: ObjectGroup[];
  objectMapping: Record<string, string>;
  salesforceProperties: Record<string, string>;
  hubspotObjectOptions: Array<{ value: string; label: string }>;
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
  isMapping,
  onMappingChange,
  onPropertyChange,
  onExecute,
  onBack,
}: MappingConfigStepProps) => {
  const [showOnlyMapped, setShowOnlyMapped] = useState(false);

  return (
    <div className="space-y-8 pb-24">
      <Card className="border border-gray-200 shadow-sm rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">
                オブジェクトマッピング設定
              </CardTitle>
              <p className="text-gray-600 text-sm mt-1">
                ContentDocumentLink.csvからオブジェクトごとの関連添付ファイルレコード数を取得しました。
                <br />
                マッピングするオブジェクトを選択してください。
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOnlyMapped(!showOnlyMapped)}
            >
              {showOnlyMapped ? "全て表示" : "マッピング対象のみ"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {objectGroups
            .filter(
              (group) =>
                !showOnlyMapped || objectMapping[group.prefix] !== "none",
            )
            .map((group) => (
              <div
                key={group.prefix}
                className="bg-gray-50 rounded-md p-4 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm bg-blue-600 text-white px-3 py-1 rounded-full">
                    {group.prefix}
                  </span>
                  <span className="font-medium text-gray-900">
                    {group.objectName}
                  </span>
                  <span className="text-sm text-gray-500 bg-white px-2 py-1 rounded">
                    {group.count.toLocaleString()}件
                  </span>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      HubSpotオブジェクト
                    </Label>
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
                  </div>
                  {objectMapping[group.prefix] !== "none" && (
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">
                        Salesforceプロパティ名
                      </Label>
                      <Input
                        value={salesforceProperties[group.prefix] || ""}
                        onChange={(e) =>
                          onPropertyChange(group.prefix, e.target.value)
                        }
                        placeholder="salesforce_id"
                        className="h-10"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      <FixedActionBar
        leftButton={{
          label: "戻る",
          onClick: onBack,
        }}
        rightButton={{
          label: "ファイルマッピング実行",
          onClick: onExecute,
          disabled:
            isMapping ||
            Object.values(objectMapping).every((v) => v === "none"),
          loading: isMapping,
        }}
        centerContent={`マッピング対象: ${Object.values(objectMapping).filter((v) => v !== "none").length}件`}
      />
    </div>
  );
};
