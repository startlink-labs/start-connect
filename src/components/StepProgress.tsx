import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepProgressProps {
  currentStep: "files" | "mapping" | "download";
  downloadCompleted?: boolean;
  className?: string;
}

const steps = [
  { id: "files", label: "ファイル選択", description: "CSVファイルを選択" },
  {
    id: "mapping",
    label: "マッピング設定",
    description: "オブジェクトをマッピング",
  },
  {
    id: "download",
    label: "結果サマリー",
    description: "処理結果内容をダウンロード",
  },
];

export function StepProgress({
  currentStep,
  downloadCompleted = false,
  className,
}: StepProgressProps) {
  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <div className={cn("w-full max-w-4xl mx-auto px-4", className)}>
      <div className="flex items-center justify-center">
        {steps.map((step, index) => {
          const isCompleted =
            index < currentStepIndex ||
            (step.id === "download" && downloadCompleted);
          const isCurrent = index === currentStepIndex && !downloadCompleted;
          const isUpcoming = index > currentStepIndex && !downloadCompleted;

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center",
                index < steps.length - 1 ? "flex-1" : "flex-none",
              )}
            >
              {/* ステップアイコン */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                    isCompleted &&
                      "bg-primary border-primary text-primary-foreground",
                    isCurrent && "border-primary bg-primary/10 text-primary",
                    isUpcoming &&
                      "border-muted bg-background text-muted-foreground",
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>

                {/* ステップ情報 */}
                <div className="mt-2 text-center">
                  <div
                    className={cn(
                      "text-sm font-medium",
                      (isCompleted || isCurrent) && "text-foreground",
                      isUpcoming && "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </div>
                  <div
                    className={cn(
                      "text-xs mt-1",
                      (isCompleted || isCurrent) && "text-muted-foreground",
                      isUpcoming && "text-muted-foreground/60",
                    )}
                  >
                    {step.description}
                  </div>
                </div>
              </div>

              {/* 接続線 */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-4 mt-[-20px] transition-colors",
                    isCompleted && "bg-primary",
                    !isCompleted && "bg-muted",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
