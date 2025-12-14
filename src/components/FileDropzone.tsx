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
}

export function FileDropzone({
  onFileSelect,
  value,
  placeholder = "ファイルを選択またはドロップ",
  disabled = false,
  label,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const selectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "CSV",
            extensions: ["csv"],
          },
        ],
      });
      if (selected) {
        onFileSelect(selected as string);
        toast.success(`ファイルが選択されました: ${selected.split("/").pop()}`);
      }
    } catch (error) {
      console.error("ファイル選択エラー:", error);
      toast.error("ファイル選択に失敗しました");
    }
  };

  const clearFile = () => {
    onFileSelect("");
  };

  const fileName = value ? value.split("/").pop() || value : null;

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700">{label}</div>
      <button
        type="button"
        className={cn(
          "relative border-2 border-dashed rounded-md p-6 transition-colors cursor-pointer w-full text-left",
          isDragOver && "border-blue-400 bg-blue-50",
          !isDragOver && !value && "border-gray-300 hover:border-gray-400",
          !isDragOver && value && "border-green-300 bg-green-50",
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
              <File className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">{fileName}</p>
                <p className="text-xs text-gray-500">選択済み</p>
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
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-900">
                クリックしてファイルを選択
              </p>
              <p className="text-xs text-gray-500 mt-1">{placeholder}</p>
            </div>
          </div>
        )}
      </button>
    </div>
  );
}
