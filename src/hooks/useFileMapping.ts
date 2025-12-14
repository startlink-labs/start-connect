import { useMutation } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

interface FileMappingResponse {
  success: boolean;
  message: string;
  processed_records: number;
  uploaded_files: number;
}

interface ProgressInfo {
  step: string;
  progress: number;
  message: string;
}

interface ObjectMapping {
  hubspot_object: string;
  salesforce_property: string;
}

export const useFileMapping = () => {
  const [progress, setProgress] = useState<ProgressInfo | null>(null);

  useEffect(() => {
    const unlisten = listen<ProgressInfo>("file-mapping-progress", (event) => {
      setProgress(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const mutation = useMutation({
    mutationFn: ({
      contentVersionPath,
      contentDocumentLinkPath,
      contentVersionFolderPath,
      objectMappings,
    }: {
      contentVersionPath: string;
      contentDocumentLinkPath: string;
      contentVersionFolderPath: string;
      objectMappings: Record<string, ObjectMapping>;
    }): Promise<FileMappingResponse> =>
      invoke("process_file_mapping", {
        contentVersionPath,
        contentDocumentLinkPath,
        contentVersionFolderPath,
        objectMappings,
      }),
    onMutate: () => {
      setProgress(null);
    },
    onSettled: () => {
      setProgress(null);
    },
  });

  return {
    ...mutation,
    progress,
  };
};
