// モジュール宣言
mod commands;
mod csv_processor;
mod hubspot;

use tauri::Manager;



/// Tauriアプリケーションのメインエントリーポイント
/// 必要なプラグインとコマンドを登録してアプリケーションを起動
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 必要なプラグインを初期化
        .plugin(tauri_plugin_dialog::init()) // ファイルダイアログ
        .plugin(tauri_plugin_http::init())   // HTTP通信
        .plugin(tauri_plugin_fs::init())     // ファイルシステム
        // フロントエンドから呼び出し可能なコマンドを登録
        .invoke_handler(tauri::generate_handler![
            commands::verify_hubspot_token,
            commands::get_hubspot_objects,
            commands::analyze_csv_files,
            commands::process_file_mapping
        ])
        .setup(|app| {
            // デバッグビルド時のみログプラグインを有効化
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            
            // 開発時のみdevtoolsを表示
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.open_devtools();
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Tauriアプリケーションの実行中にエラーが発生しました");
}
