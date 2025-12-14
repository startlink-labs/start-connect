// HubSpotオブジェクトタイプID定義

use std::collections::HashMap;

/// HubSpot標準オブジェクトのタイプIDマッピング
pub fn get_object_type_id(object_name: &str) -> String {
  let mappings: HashMap<&str, &str> = [
    ("companies", "0-2"),
    ("contacts", "0-1"),
    ("deals", "0-3"),
    ("tickets", "0-5"),
    ("appointments", "0-421"),
    ("calls", "0-48"),
    ("communications", "0-18"),
    ("courses", "0-410"),
    ("emails", "0-49"),
    ("feedback_submissions", "0-19"),
    ("invoices", "0-53"),
    ("leads", "0-136"),
    ("line_items", "0-8"),
    ("listings", "0-420"),
    ("marketing_events", "0-54"),
    ("meetings", "0-47"),
    ("notes", "0-46"),
    ("orders", "0-123"),
    ("payments", "0-101"),
    ("postal_mail", "0-116"),
    ("products", "0-7"),
    ("quotes", "0-14"),
    ("services", "0-162"),
    ("subscriptions", "0-69"),
    ("tasks", "0-27"),
    ("users", "0-115"),
  ]
  .iter()
  .cloned()
  .collect();

  mappings
    .get(object_name)
    .map(|s| s.to_string())
    .unwrap_or_else(|| format!("2-{}", object_name))
}

/// HubSpotレコードURLを構築
pub fn build_record_url(
  ui_domain: &str,
  portal_id: &str,
  object_name: &str,
  record_id: &str,
) -> String {
  let type_id = get_object_type_id(object_name);
  format!(
    "https://{}/contacts/{}/record/{}/{}",
    ui_domain, portal_id, type_id, record_id
  )
}
