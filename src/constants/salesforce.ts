// Salesforce標準オブジェクト定義
export const SALESFORCE_OBJECTS: Record<string, string> = {
  "001": "Account (取引先)",
  "003": "Contact (取引先責任者)",
  "006": "Opportunity (商談)",
  "500": "Case (ケース)",
  "701": "Campaign (キャンペーン)",
  "00Q": "Lead (リード)",
  "00T": "Task (タスク)",
  "00U": "Event (行動)",
};

// マッピング優先順位
export const MAPPING_PRIORITY = [
  "001",
  "003",
  "006",
  "500",
  "00Q",
  "701",
  "00T",
  "00U",
];

// デフォルトマッピング
export const DEFAULT_MAPPING: Record<string, string> = {
  "001": "companies",
  "003": "contacts",
  "006": "deals",
  "500": "tickets",
  "00Q": "contacts",
};
