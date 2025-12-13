import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useHubSpotObjects } from "../hooks/useHubSpotObjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

interface ValidationResult {
	object_type: string;
	total_records: number;
	found_records: number;
	file_count: number;
}

function FileTransfer() {
	const { isAuthenticated } = useAuth();
	const { objects: hubspotObjects } = useHubSpotObjects();
	const [contentVersionPath, setContentVersionPath] = useState("");
	const [contentDocumentLinkPath, setContentDocumentLinkPath] = useState("");
	const [contentVersionFolderPath, setContentVersionFolderPath] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);
	const [status, setStatus] = useState("");
	const [step, setStep] = useState<'files' | 'mapping'>('files');
	const [objectGroups, setObjectGroups] = useState<ObjectGroup[]>([]);
	const [objectMapping, setObjectMapping] = useState<ObjectMapping>({});
	const [salesforceProperties, setSalesforceProperties] = useState<SalesforceProperty>({});
	const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
	const [isValidating, setIsValidating] = useState(false);
	const [isMapping, setIsMapping] = useState(false);


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

	const selectFile = async (setPath: (path: string) => void) => {
		try {
			console.log('ファイル選択を開始...');
			const { open } = await import('@tauri-apps/plugin-dialog');
			console.log('ダイアログプラグイン読み込み完了');
			const selected = await open({
				multiple: false,
				filters: [{
					name: 'CSV',
					extensions: ['csv']
				}]
			});
			console.log('ファイル選択結果:', selected);
			if (selected) {
				setPath(selected as string);
				setStatus(`ファイル「${selected}」が選択されました`);
			} else {
				setStatus('ファイル選択がキャンセルされました');
			}
		} catch (error) {
			console.error('ファイル選択エラー:', error);
			setStatus(`エラー: ${error}`);
		}
	};

	if (!isAuthenticated) {
		return <Navigate to="/login" />;
	}

	const handleAnalyze = async () => {
		if (!contentVersionPath.trim() || !contentDocumentLinkPath.trim()) {
			setStatus("両方のファイルを選択してください");
			return;
		}

		setIsProcessing(true);
		setStatus("オブジェクトを分析中...");

		try {
			const response = await fetch("http://localhost:8000/api/v1/file-transfer/analyze", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					content_version_path: contentVersionPath,
					content_document_link_path: contentDocumentLinkPath,
				}),
			});

			if (response.ok) {
				const result = await response.json();
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
				setStatus(`${groups.length}種類のオブジェクトを検出しました`);
			} else {
				const error = await response.json();
				setStatus(`エラー: ${error.detail}`);
			}
		} catch (error) {
			setStatus(`エラー: ${error}`);
		} finally {
			setIsProcessing(false);
		}
	};

	const handleMappingChange = (prefix: string, hubspotObject: string) => {
		setObjectMapping(prev => ({ ...prev, [prefix]: hubspotObject }));
	};

	const handlePropertyChange = (prefix: string, property: string) => {
		setSalesforceProperties(prev => ({ ...prev, [prefix]: property }));
	};

	const { user } = useAuth();

	const handleFileMapping = async () => {
		if (isMapping) return;
		
		if (!user?.token) {
			setStatus("トークンがありません");
			return;
		}

		setIsMapping(true);
		setStatus("ファイルマッピングを開始中...");

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

			const response = await fetch("http://localhost:8000/api/v1/file-mapping", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					token: user.token,
					content_version_path: contentVersionPath,
					content_document_link_path: contentDocumentLinkPath,
					content_version_folder_path: contentVersionFolderPath,
					object_mappings: mappings
				})
			});

			if (response.ok) {
				const data = await response.json();
				setStatus(data.message);
			} else {
				const error = await response.json();
				setStatus(`エラー: ${error.detail}`);
			}
		} catch (error) {
			setStatus(`エラー: ${error}`);
		} finally {
			setIsMapping(false);
		}
	};

	const handleValidateRecords = async () => {
		if (isValidating) return;
		
		if (!user?.token) {
			setStatus("トークンがありません");
			return;
		}

		setIsValidating(true);
		setStatus("レコードを検証中...");

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

			const response = await fetch("http://localhost:8000/api/v1/validate-records", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					token: user.token,
					content_document_link_path: contentDocumentLinkPath,
					object_mappings: mappings
				})
			});

			if (response.ok) {
				const data = await response.json();
				setValidationResults(data.results);
				setStatus(data.message);
			} else {
				const error = await response.json();
				setStatus(`エラー: ${error.detail}`);
			}
		} catch (error) {
			setStatus(`エラー: ${error}`);
		} finally {
			setIsValidating(false);
		}
	};

	return (
		<div className="p-6">
			<div className="max-w-2xl mx-auto">
				<Card>
					<CardHeader>
						<CardTitle>Salesforce → HubSpot ファイル転送</CardTitle>
					</CardHeader>
					<CardContent>
						{step === 'files' && (
							<div className="space-y-6">
							<div className="space-y-2">
								<Label>ContentVersion.csv ファイル</Label>
								<div className="flex gap-2">
									<Input
										type="text"
										value={contentVersionPath}
										onChange={(e) => setContentVersionPath(e.target.value)}
										placeholder="ファイルを選択してください"
										disabled={isProcessing}
										className="flex-1"
									/>
									<Button
										type="button"
										variant="outline"
										onClick={() => selectFile(setContentVersionPath)}
										disabled={isProcessing}
									>
										選択
									</Button>
								</div>
							</div>

							<div className="space-y-2">
								<Label>ContentDocumentLink.csv ファイル</Label>
								<div className="flex gap-2">
									<Input
										type="text"
										value={contentDocumentLinkPath}
										onChange={(e) => setContentDocumentLinkPath(e.target.value)}
										placeholder="ファイルを選択してください"
										disabled={isProcessing}
										className="flex-1"
									/>
									<Button
										type="button"
										variant="outline"
										onClick={() => selectFile(setContentDocumentLinkPath)}
										disabled={isProcessing}
									>
										選択
									</Button>
								</div>
							</div>

							<div className="space-y-2">
								<Label>ContentVersion フォルダパス</Label>
								<Input
									type="text"
									value={contentVersionFolderPath}
									onChange={(e) => setContentVersionFolderPath(e.target.value)}
									placeholder="ContentVersionフォルダのパスを入力"
									disabled={isProcessing}
								/>
							</div>

							{status && (
								<div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
									<p className="text-sm text-blue-800">{status}</p>
								</div>
							)}

								<div className="flex gap-4">
									<Button onClick={handleAnalyze} disabled={isProcessing} className="flex-1">
										{isProcessing ? "分析中..." : "オブジェクト分析"}
									</Button>
									<Button 
										variant="outline" 
										onClick={() => window.history.back()}
										disabled={isProcessing}
									>
										戻る
									</Button>
								</div>
							</div>
						)}

						{step === 'mapping' && (
							<div className="space-y-6">
								{validationResults.length === 0 && (
									<>
										<h3 className="text-lg font-medium">HubSpotオブジェクトマッピング</h3>
										<div className="space-y-4">
											{objectGroups.map(group => (
												<div key={group.prefix} className="p-3 border rounded space-y-3">
													<div className="flex items-center gap-2">
														<span className="font-mono text-sm bg-blue-100 px-2 py-1 rounded">{group.prefix}</span>
														<span className="text-sm text-gray-600">{group.objectName}</span>
														<span className="text-sm text-gray-500">({group.count.toLocaleString()}件)</span>
													</div>
													<div className="grid grid-cols-2 gap-3">
														<div>
															<Label className="text-xs">HubSpotオブジェクト</Label>
															<Select 
																value={objectMapping[group.prefix] || ""}
																onValueChange={(value) => handleMappingChange(group.prefix, value)}
															>
																<SelectTrigger className="h-8">
																	<SelectValue placeholder="選択" />
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
																<Label className="text-xs">Salesforceプロパティ名</Label>
																<Input
																	value={salesforceProperties[group.prefix] || ""}
																	onChange={(e) => handlePropertyChange(group.prefix, e.target.value)}
																	placeholder="salesforce_id"
																	className="h-8 text-sm"
																/>
															</div>
														)}
													</div>
												</div>
											))}
										</div>
									</>
								)}
								
								{validationResults.length > 0 && (
									<div className="space-y-4">
										<h3 className="text-lg font-medium">検証結果</h3>
										<div className="space-y-3">
											{validationResults.map(result => (
												<div key={result.object_type} className="flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded">
													<span className="font-medium">{result.object_type}</span>
													<span className="text-green-700 font-semibold">{result.found_records}/{result.total_records}件</span>
												</div>
											))}
										</div>
									</div>
								)}

								{status && (
									<div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
										<p className="text-sm text-blue-800">{status}</p>
									</div>
								)}



								<div className="flex gap-2">
									{validationResults.length === 0 && (
										<>
											<Button 
												onClick={handleValidateRecords}
												disabled={isValidating || isMapping} 
												variant="outline"
												className="flex-1"
											>
												{isValidating ? "検証中..." : "レコード検証"}
											</Button>
											<Button 
												onClick={handleFileMapping}
												disabled={isValidating || isMapping} 
												className="flex-1"
											>
												{isMapping ? "マッピング中..." : "ファイルマッピング実行"}
											</Button>
										</>
									)}
									{validationResults.length > 0 && (
										<Button 
											onClick={() => {
												setValidationResults([]);
												setStatus('');
											}}
											variant="outline"
											className="flex-1"
										>
											マッピングを編集
										</Button>
									)}
									<Button variant="outline" onClick={() => setStep('files')}>
										戻る
									</Button>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}