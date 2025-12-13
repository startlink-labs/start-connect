use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      // 開発時だけdevtoolsを表示する。
      #[cfg(debug_assertions)]
      app.get_webview_window("main").unwrap().open_devtools();

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
