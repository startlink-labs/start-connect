use std::sync::Mutex;

pub struct OAuthState {
  pub pending_auth: Mutex<Option<String>>,
}

pub fn generate_auth_url(client_id: &str, worker_url: &str, state: &str) -> String {
  let scopes = vec![
    "oauth",
    "crm.objects.contacts.read",
    "crm.objects.contacts.write",
    "crm.objects.companies.read",
    "crm.objects.companies.write",
    "crm.objects.deals.read",
    "crm.objects.deals.write",
    "crm.objects.custom.read",
    "crm.objects.custom.write",
    "crm.schemas.contacts.read",
    "crm.schemas.companies.read",
    "crm.schemas.deals.read",
    "crm.schemas.custom.read",
    "tickets",
    "files",
  ];

  format!(
    "https://app.hubspot.com/oauth/authorize?client_id={}&redirect_uri={}/oauth/callback&scope={}&state={}",
    client_id,
    worker_url,
    scopes.join("%20"),
    state
  )
}

pub fn generate_state() -> String {
  use rand::Rng;
  const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let mut rng = rand::thread_rng();

  (0..32)
    .map(|_| {
      let idx = rng.gen_range(0..CHARSET.len());
      CHARSET[idx] as char
    })
    .collect()
}
