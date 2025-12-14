// モジュール宣言
mod auth;
mod commands;
mod csv;
mod hubspot;

use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

/// Tauriアプリケーションのメインエントリーポイント
/// 必要なプラグインとコマンドを登録してアプリケーションを起動
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default();

  // Desktop: single-instanceプラグインを最初に初期化
  #[cfg(desktop)]
  {
    builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
      log::info!("New app instance opened with args: {:?}", argv);
      // Deep linkイベントは自動的にトリガーされる
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
      }
    }));
  }

  builder
    // 必要なプラグインを初期化
    .plugin(tauri_plugin_updater::Builder::new().build()) // 自動更新
    .plugin(tauri_plugin_process::init()) // プロセス管理
    .plugin(tauri_plugin_dialog::init()) // ファイルダイアログ
    .plugin(tauri_plugin_http::init()) // HTTP通信
    .plugin(tauri_plugin_fs::init()) // ファイルシステム
    .plugin(tauri_plugin_shell::init()) // シェルコマンド実行
    .plugin(tauri_plugin_deep_link::init()) // Deep Link
    // フロントエンドから呼び出し可能なコマンドを登録
    .invoke_handler(tauri::generate_handler![
      // OAuth認証
      commands::is_authenticated,
      commands::logout,
      commands::start_oauth_flow,
      commands::save_oauth_tokens,
      // ビジネスロジック
      commands::get_hubspot_objects,
      commands::analyze_csv_files,
      commands::analyze_chatter_files,
      commands::process_file_mapping,
      commands::process_chatter_migration,
      commands::save_result_csv,
      commands::cleanup_temp_csv
    ])
    .manage(auth::OAuthState {
      pending_auth: std::sync::Mutex::new(None),
    })
    .setup(|app| {
      // デバッグビルド時のみログプラグインを有効化
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Debug)
            .build(),
        )?;
      }

      // Deep Link処理をRust側で実装
      // アプリ起動時のDeep Linkを処理
      if let Ok(Some(urls)) = app.deep_link().get_current() {
        log::info!("[DeepLink] App started with deep link: {:?}", urls);
        if let Some(url) = urls.first() {
          if url.as_str().starts_with("sfhsfiletrans://oauth/callback") {
            log::info!("[DeepLink] Emitting deep-link-urls event");
            if let Some(window) = app.get_webview_window("main") {
              let _ = window.emit("deep-link-urls", &urls);
            }
          }
        }
      } else {
        log::info!("[DeepLink] No deep link on startup");
      }

      // Deep Linkイベントをリッスン
      let handle = app.handle().clone();
      app.deep_link().on_open_url(move |event| {
        let urls = event.urls();
        log::info!("[DeepLink] Deep link received: {:?}", urls);
        if let Some(url) = urls.first() {
          if url.as_str().starts_with("sfhsfiletrans://oauth/callback") {
            log::info!("[DeepLink] Emitting deep-link-urls event");
            if let Some(window) = handle.get_webview_window("main") {
              let _ = window.emit("deep-link-urls", &urls);
            }
          }
        }
      });

      // 開発時のみdevtoolsを表示
      #[cfg(debug_assertions)]
      {
        if let Some(window) = app.get_webview_window("main") {
          window.open_devtools();
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("Tauriアプリケーションの実行中にエラーが発生しました");
}
