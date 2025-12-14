import { createFileRoute, Navigate } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { FileSelectionStep } from "@/components/file-transfer/FileSelectionStep";
import { MappingConfigStep } from "@/components/file-transfer/MappingConfigStep";
import { ResultSummaryStep } from "@/components/file-transfer/ResultSummaryStep";
import { StepProgress } from "@/components/StepProgress";
import { useAuth } from "@/hooks/useAuth";
import { useCsvAnalysis } from "@/hooks/useCsvAnalysis";
import { useFileMapping } from "@/hooks/useFileMapping";
import { useHubSpotObjects } from "@/hooks/useHubSpotObjects";
import { useHeaderStore } from "@/stores/headerStore";

export const Route = createFileRoute("/file-transfer")({
  component: FileTransfer,
});

function FileTransfer() {
  const { isAuthenticated } = useAuth();
  const { setCenterMessage } = useHeaderStore();
  const { objects: hubspotObjects } = useHubSpotObjects();
  const { isProcessing, objectGroups, analyzeFiles } = useCsvAnalysis();
  const { isMapping, resultCsvPath, summaries, processFileMapping, reset } =
    useFileMapping();

  const [step, setStep] = useState<"files" | "mapping" | "download">("files");
  const [contentVersionPath, setContentVersionPath] = useState("");
  const [contentDocumentLinkPath, setContentDocumentLinkPath] = useState("");
  const [contentVersionFolderPath, setContentVersionFolderPath] = useState("");
  const [objectMapping, setObjectMapping] = useState<Record<string, string>>(
    {},
  );
  const [salesforceProperties, setSalesforceProperties] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    setCenterMessage("ファイルマッピング");
    return () => setCenterMessage(null);
  }, [setCenterMessage]);

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  const hubspotObjectOptions = [
    { value: "none", label: "マッピングしない" },
    ...hubspotObjects.map((obj) => ({
      value: obj.object_type_id,
      label: obj.label,
    })),
  ];

  const handleAnalyze = async () => {
    const result = await analyzeFiles(
      contentVersionPath,
      contentDocumentLinkPath,
    );
    if (result) {
      setObjectMapping(result.initialMapping);
      setSalesforceProperties(result.initialProperties);
      setStep("mapping");
    }
  };

  const handleExecuteMapping = async () => {
    const mappings = Object.entries(objectMapping)
      .filter(([_, hubspotObject]) => hubspotObject !== "none")
      .reduce(
        (acc, [prefix, hubspotObject]) => {
          acc[prefix] = {
            hubspot_object: hubspotObject,
            salesforce_property:
              salesforceProperties[prefix] || "salesforce_id",
          };
          return acc;
        },
        {} as Record<
          string,
          { hubspot_object: string; salesforce_property: string }
        >,
      );

    await processFileMapping(
      contentVersionPath,
      contentDocumentLinkPath,
      contentVersionFolderPath,
      mappings,
    );
    setStep("download");
    setCenterMessage(null);
  };

  const handleReset = () => {
    if (resultCsvPath) {
      invoke("cleanup_temp_csv", { tempPath: resultCsvPath }).catch(() => {});
    }
    setStep("files");
    setContentVersionPath("");
    setContentDocumentLinkPath("");
    setContentVersionFolderPath("");
    setObjectMapping({});
    setSalesforceProperties({});
    reset();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <StepProgress currentStep={step} className="mb-8" />

        {step === "files" && (
          <FileSelectionStep
            contentVersionPath={contentVersionPath}
            contentDocumentLinkPath={contentDocumentLinkPath}
            contentVersionFolderPath={contentVersionFolderPath}
            isProcessing={isProcessing}
            onContentVersionPathChange={setContentVersionPath}
            onContentDocumentLinkPathChange={setContentDocumentLinkPath}
            onContentVersionFolderPathChange={setContentVersionFolderPath}
            onAnalyze={handleAnalyze}
            onBack={() => window.history.back()}
          />
        )}

        {step === "mapping" && (
          <MappingConfigStep
            objectGroups={objectGroups}
            objectMapping={objectMapping}
            salesforceProperties={salesforceProperties}
            hubspotObjectOptions={hubspotObjectOptions}
            isMapping={isMapping}
            onMappingChange={(prefix, value) =>
              setObjectMapping((prev) => ({ ...prev, [prefix]: value }))
            }
            onPropertyChange={(prefix, value) =>
              setSalesforceProperties((prev) => ({ ...prev, [prefix]: value }))
            }
            onExecute={handleExecuteMapping}
            onBack={() => setStep("files")}
          />
        )}

        {step === "download" && (
          <ResultSummaryStep
            summaries={summaries}
            resultCsvPath={resultCsvPath}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
