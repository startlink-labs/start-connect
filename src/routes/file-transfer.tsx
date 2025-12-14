import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useHubSpotObjects } from "../hooks/useHubSpotObjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDropzone } from "../components/FileDropzone";
import { FixedActionBar } from "../components/FixedActionBar";
import { StepProgress } from "../components/StepProgress";
import { FolderOpen } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useHeaderStore } from "../stores/headerStore";

export const Route = createFileRoute("/file-transfer")({
	component: FileTransfer,
});

interface ObjectGroup {
	prefix: string;
	count: number;
	objectName: string;
}

interface ObjectMapping {
	[prefix: string]: string;
}

interface SalesforceProperty {
	[prefix: string]: string;
}

function FileTransfer() {
	const { isAuthenticated, portalInfo } = useAuth();
	const { setCenterMessage } = useHeaderStore();
	const { objects: hubspotObjects } = useHubSpotObjects();
	const [contentVersionPath, setContentVersionPath] = useState("");
	const [contentDocumentLinkPath, setContentDocumentLinkPath] = useState("");
	const [contentVersionFolderPath, setContentVersionFolderPath] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);
	const [step, setStep] = useState<'files' | 'mapping' | 'download'>('files');
	const [objectGroups, setObjectGroups] = useState<ObjectGroup[]>([]);
	const [objectMapping, setObjectMapping] = useState<ObjectMapping>({});
	const [salesforceProperties, setSalesforceProperties] = useState<SalesforceProperty>({});
	const [isMapping, setIsMapping] = useState(false);
	const [showOnlyMapped, setShowOnlyMapped] = useState(false);

	useEffect(() => {
		setCenterMessage("ファイルマッピング");
		return () => setCenterMessage(null);
	}, [setCenterMessage]);

	// Salesforce標準オブジェクト定義
	const SALESFORCE_OBJECTS: { [key: string]: string } = {
		"001": "Account (取引先)",
		"003": "Contact (取引先責任者)",
		"006": "Opportunity (商談)",
		"500": "Case (ケース)",
		"701": "Campaign (キャンペーン)",
		"00Q": "Lead (リード)",
		"00T": "Task (タスク)",
		"00U": "Event (行動)",
	};

	// HubSpotオブジェクトタイプ（取得したオブジェクト + マッピングしないオプション）
	const hubspotObjectOptions = [
		{ value: "none", label: "マッピングしない" },
		...hubspotObjects.map(obj => ({ value: obj.object_type_id, label: obj.label }))
	];

	// マッピング優先順位
	const MAPPING_PRIORITY = [
		"001", "003", "006", "500", "00Q", "701", "00T", "00U"
	];

	if (!isAuthenticated) {
		return <Navigate to="/login" />;
	}

	const handleAnalyze = async () => {
		if (!contentVersionPath.trim() || !contentDocumentLinkPath.trim()) {
			toast.error("両方のファイルを選択してください");
			return;
		}

		setIsProcessing(true);
		toast.loading("オブジェクトを分析中...");

		try {
			const result = await invoke('analyze_csv_files', {
				contentVersionPath,
				contentDocumentLinkPath,
			}) as { object_groups: Record<string, number> };

			const groups: ObjectGroup[] = Object.entries(result.object_groups).map(([prefix, count]) => ({
				prefix,
				count: count as number,
				objectName: SALESFORCE_OBJECTS[prefix] || "カスタムオブジェクト",
			})).sort((a, b) => {
				// マッピング優先順位でソート
				const aPriority = MAPPING_PRIORITY.indexOf(a.prefix);
				const bPriority = MAPPING_PRIORITY.indexOf(b.prefix);
				if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
				if (aPriority !== -1) return -1;
				if (bPriority !== -1) return 1;
				return b.count - a.count; // その他は件数順
			});
			
			setObjectGroups(groups);
			
			// デフォルトマッピングを設定
			const defaultMapping: ObjectMapping = {
				"001": "companies",
				"003": "contacts",
				"006": "deals",
				"500": "tickets",
				"00Q": "contacts",
			};
			
			const initialMapping: ObjectMapping = {};
			groups.forEach(group => {
				initialMapping[group.prefix] = defaultMapping[group.prefix] || "none";
			});
			
			setObjectMapping(initialMapping);
			
			// デフォルトSalesforceプロパティを設定
			const defaultProperties: SalesforceProperty = {};
			groups.forEach(group => {
				defaultProperties[group.prefix] = "salesforce_id";
			});
			setSalesforceProperties(defaultProperties);
			
			setStep('mapping');
			toast.success(`${groups.length}種類のオブジェクトを検出しました`);
		} catch (error) {
			toast.error(`エラー: ${error}`);
		} finally {
			toast.dismiss();
			setIsProcessing(false);
		}
	};

	const handleMappingChange = (prefix: string, hubspotObject: string) => {
		setObjectMapping(prev => ({ ...prev, [prefix]: hubspotObject }));
	};

	const handlePropertyChange = (prefix: string, property: string) => {
		setSalesforceProperties(prev => ({ ...prev, [prefix]: property }));
	};

	const handleFileMapping = async () => {
		if (isMapping) return;

		setIsMapping(true);
		toast.loading("ファイルマッピングを開始中...");

		try {
			const mappings = Object.entries(objectMapping)
				.filter(([_, hubspotObject]) => hubspotObject !== 'none')
				.reduce((acc, [prefix, hubspotObject]) => {
					acc[prefix] = {
						hubspot_object: hubspotObject,
						salesforce_property: salesforceProperties[prefix] || 'salesforce_id'
					};
					return acc;
				}, {} as any);

			const result = await invoke('process_file_mapping', {
				contentVersionPath,
				contentDocumentLinkPath,
				contentVersionFolderPath,
				objectMappings: mappings
			}) as { message: string };

			toast.success(result.message);
			setStep('download');
		} catch (error) {
			toast.error(`エラー: ${error}`);
		} finally {
			toast.dismiss();
			setIsMapping(false);
			setCenterMessage(null);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
			<div className="max-w-4xl mx-auto">
				{/* ステップ進行状況 */}
				<StepProgress currentStep={step} className="mb-8" />

				{step === 'files' && (
					<div className="space-y-8 pb-24">
						{/* ファイル選択セクション */}
						<Card className="border border-gray-200 shadow-sm rounded-lg">
							<CardHeader className="pb-4">
								<CardTitle className="flex items-center gap-2 text-lg">
									<FolderOpen className="h-5 w-5 text-blue-600" />
									ファイル選択
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="grid md:grid-cols-2 gap-6">
									<FileDropzone
										label="ContentVersion.csv"
										value={contentVersionPath}
										onFileSelect={setContentVersionPath}
										disabled={isProcessing}
										placeholder="ファイル情報のCSVファイル"
									/>
									<FileDropzone
										label="ContentDocumentLink.csv"
										value={contentDocumentLinkPath}
										onFileSelect={setContentDocumentLinkPath}
										disabled={isProcessing}
										placeholder="リンク情報のCSVファイル"
									/>
								</div>

								<div className="space-y-2">
									<Label className="text-sm font-medium text-gray-700">
										ContentVersion フォルダパス
									</Label>
									<Input
										type="text"
										value={contentVersionFolderPath}
										onChange={(e) => setContentVersionFolderPath(e.target.value)}
										placeholder="/path/to/ContentVersion/folder"
										disabled={isProcessing}
										className="h-11"
									/>
								</div>
							</CardContent>
						</Card>

						<FixedActionBar
							leftButton={{
								label: "戻る",
								onClick: () => window.history.back(),
								disabled: isProcessing
							}}
							rightButton={{
								label: "オブジェクト分析",
								onClick: handleAnalyze,
								disabled: isProcessing || !contentVersionPath || !contentDocumentLinkPath,
								loading: isProcessing
							}}
							centerContent={contentVersionPath && contentDocumentLinkPath ? "ファイル選択完了" : "ファイルを選択してください"}
						/>
					</div>
				)}

				{step === 'mapping' && (
					<div className="space-y-8 pb-24">
						<Card className="border border-gray-200 shadow-sm rounded-lg">
							<CardHeader>
								<div className="flex items-center justify-between">
									<div>
										<CardTitle className="text-xl">オブジェクトマッピング設定</CardTitle>
										<p className="text-gray-600 text-sm mt-1">
											ContentDocumentLink.csvからオブジェクトごとの関連添付ファイルレコード数を取得しました。<br />
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
									.filter(group => !showOnlyMapped || objectMapping[group.prefix] !== "none")
									.map(group => (
									<div key={group.prefix} className="bg-gray-50 rounded-md p-4 space-y-3">
										<div className="flex items-center gap-3">
											<span className="font-mono text-sm bg-blue-600 text-white px-3 py-1 rounded-full">
												{group.prefix}
											</span>
											<span className="font-medium text-gray-900">{group.objectName}</span>
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
													onValueChange={(value) => handleMappingChange(group.prefix, value)}
												>
													<SelectTrigger className="h-10">
														<SelectValue placeholder="選択してください" />
													</SelectTrigger>
													<SelectContent>
														{hubspotObjectOptions.map(obj => (
															<SelectItem key={obj.value} value={obj.value}>{obj.label}</SelectItem>
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
														onChange={(e) => handlePropertyChange(group.prefix, e.target.value)}
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
								onClick: () => setStep('files')
							}}
							rightButton={{
								label: "ファイルマッピング実行",
								onClick: handleFileMapping,
								disabled: isMapping || Object.values(objectMapping).every(v => v === "none"),
								loading: isMapping
							}}
							centerContent={`マッピング対象: ${Object.values(objectMapping).filter(v => v !== "none").length}件`}
						/>
					</div>
				)}

				{step === 'download' && (
					<div className="space-y-8 pb-24">
						<Card className="border border-gray-200 shadow-sm rounded-lg">
							<CardHeader>
								<CardTitle className="text-xl text-center">処理完了</CardTitle>
								<p className="text-gray-600 text-sm text-center mt-2">
									ファイルマッピングが完了しました。結果をダウンロードしてください。
								</p>
							</CardHeader>
							<CardContent className="text-center space-y-4">
								<div className="bg-green-50 border border-green-200 rounded-lg p-6">
									<div className="text-green-600 text-lg font-medium mb-2">
										✓ マッピング処理が正常に完了しました
									</div>
									<p className="text-green-700 text-sm">
										処理結果のCSVファイルをダウンロードできます
									</p>
								</div>
							</CardContent>
						</Card>

						<FixedActionBar
							leftButton={{
								label: "最初から",
								onClick: () => {
									setStep('files');
									setObjectGroups([]);
									setObjectMapping({});
									setSalesforceProperties({});
									setContentVersionPath("");
									setContentDocumentLinkPath("");
									setContentVersionFolderPath("");
								}
							}}
							rightButton={{
								label: "CSVダウンロード",
								onClick: () => {
									// TODO: CSVダウンロード機能を実装
									toast.info("CSVダウンロード機能は実装予定です");
								}
							}}
							centerContent="処理完了"
						/>
					</div>
				)}
			</div>
		</div>
	);
}