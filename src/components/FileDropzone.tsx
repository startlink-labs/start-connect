import { open } from "@tauri-apps/plugin-dialog";
import { File, Upload, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  onFileSelect: (path: string) => void;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  accept?: string;
  label: string;
  isDirectory?: boolean;
}

export function FileDropzone({
  onFileSelect,
  value,
  placeholder = "ファイルを選択またはドロップ",
  disabled = false,
  label,
  isDirectory = false,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const selectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: isDirectory,
        filters: isDirectory
          ? undefined
          : [
              {
                name: "CSV",
                extensions: ["csv"],
              },
            ],
      });
      if (selected) {
        onFileSelect(selected as string);
        const displayName = selected.split("/").pop();
        toast.success(
          `${isDirectory ? "フォルダ" : "ファイル"}が選択されました: ${displayName}`,
        );
      }
    } catch (error) {
      console.error("選択エラー:", error);
      toast.error(
        `${isDirectory ? "フォルダ" : "ファイル"}選択に失敗しました`,
      );
    }
  };

  const clearFile = () => {
    onFileSelect("");
  };

  const fileName = value ? value.split("/").pop() || value : null;

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-foreground">{label}</div>
      <button
        type="button"
        className={cn(
          "relative border-2 border-dashed rounded-md p-6 transition-colors cursor-pointer w-full text-left",
          isDragOver && "border-primary bg-primary/10",
          !isDragOver &&
            !value &&
            "border-muted-foreground/30 hover:border-muted-foreground/50",
          !isDragOver && value && "border-primary bg-primary/10",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        onClick={!disabled ? selectFile : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
        }}
        disabled={disabled}
      >
        {value ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <File className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {fileName}
                </p>
                <p className="text-xs text-muted-foreground">選択済み</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
            <div className="mt-4">
              <p className="text-sm font-medium text-foreground">
                クリックして{isDirectory ? "フォルダ" : "ファイル"}を選択
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {placeholder}
              </p>
            </div>
          </div>
        )}
      </button>
    </div>
  );
}
