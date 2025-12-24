import { createFileRoute, Navigate } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { FileSelectionStep } from "@/components/chatter-migration/FileSelectionStep";
import { MappingConfigStep } from "@/components/chatter-migration/MappingConfigStep";
import { ResultSummaryStep } from "@/components/file-transfer/ResultSummaryStep";
import { StepProgress } from "@/components/StepProgress";
import { useAuth } from "@/hooks/useAuth";
import { useChatterAnalysis } from "@/hooks/useChatterAnalysis";
import { useChatterMigration } from "@/hooks/useChatterMigration";
import { useHubSpotObjects } from "@/hooks/useHubSpotObjects";
import { useHeaderStore } from "@/stores/headerStore";

export const Route = createFileRoute("/chatter-migration")({
  component: ChatterMigration,
});

function ChatterMigration() {
  const { isAuthenticated, portalInfo } = useAuth();
  const { setCenterMessage } = useHeaderStore();
  const { objects: hubspotObjects } = useHubSpotObjects();
  const { isProcessing, objectGroups, analyzeFiles } = useChatterAnalysis();
  const {
    isMigrating,
    resultCsvPath,
    summaries,
    processChatterMigration,
    reset,
  } = useChatterMigration();

  const [step, setStep] = useState<"files" | "mapping" | "download">("files");
  const [downloadCompleted, setDownloadCompleted] = useState(false);
  const [feedItemPath, setFeedItemPath] = useState("");
  const [feedCommentPath, setFeedCommentPath] = useState("");
  const [userPath, setUserPath] = useState("");
  const [contentVersionPath, setContentVersionPath] = useState("");
  const [contentDocumentLinkPath, setContentDocumentLinkPath] = useState("");
  const [feedAttachmentPath, setFeedAttachmentPath] = useState("");
  const [objectMapping, setObjectMapping] = useState<Record<string, string>>(
    {},
  );
  const [salesforceProperties, setSalesforceProperties] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    setCenterMessage("Chatter移行");
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
      feedItemPath,
      feedCommentPath,
      contentDocumentLinkPath,
    );
    if (result) {
      setObjectMapping(result.initialMapping);
      setSalesforceProperties(result.initialProperties);
      setStep("mapping");
    }
  };

  const handleExecuteMigration = async () => {
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

    await processChatterMigration(
      feedItemPath,
      feedCommentPath,
      userPath,
      contentVersionPath,
      contentDocumentLinkPath,
      feedAttachmentPath,
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
    setDownloadCompleted(false);
    setFeedItemPath("");
    setFeedCommentPath("");
    setUserPath("");
    setContentVersionPath("");
    setContentDocumentLinkPath("");
    setFeedAttachmentPath("");
    setObjectMapping({});
    setSalesforceProperties({});
    reset();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <StepProgress
          currentStep={step}
          downloadCompleted={downloadCompleted}
          className="mb-8"
        />

        {step === "files" && (
          <FileSelectionStep
            feedItemPath={feedItemPath}
            feedCommentPath={feedCommentPath}
            userPath={userPath}
            contentVersionPath={contentVersionPath}
            contentDocumentLinkPath={contentDocumentLinkPath}
            feedAttachmentPath={feedAttachmentPath}
            isProcessing={isProcessing}
            onFeedItemPathChange={setFeedItemPath}
            onFeedCommentPathChange={setFeedCommentPath}
            onUserPathChange={setUserPath}
            onContentVersionPathChange={setContentVersionPath}
            onContentDocumentLinkPathChange={setContentDocumentLinkPath}
            onFeedAttachmentPathChange={setFeedAttachmentPath}
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
            hubspotPortalId={portalInfo?.portal_id?.toString() || ""}
            isMapping={isMigrating}
            onMappingChange={(prefix, value) =>
              setObjectMapping((prev) => ({ ...prev, [prefix]: value }))
            }
            onPropertyChange={(prefix, value) =>
              setSalesforceProperties((prev) => ({ ...prev, [prefix]: value }))
            }
            onExecute={handleExecuteMigration}
            onBack={() => setStep("files")}
          />
        )}

        {step === "download" && (
          <ResultSummaryStep
            summaries={summaries}
            resultCsvPath={resultCsvPath}
            downloadCompleted={downloadCompleted}
            onReset={handleReset}
            onDownloadComplete={() => setDownloadCompleted(true)}
            isChatterMigration
          />
        )}
      </div>
    </div>
  );
}
