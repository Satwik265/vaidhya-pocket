#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use tauri_plugin_shell::ShellExt;

#[tauri::command]
fn check_backend_status() -> Result<String, String> {
    Ok("ok".to_string())
}

fn main() {
    let child_arc = Arc::new(Mutex::new(None));
    let child_arc_setup = Arc::clone(&child_arc);
    let child_arc_window = Arc::clone(&child_arc);
    let child_arc_exit = Arc::clone(&child_arc);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![check_backend_status])
        .setup(move |app| {
            println!("[MedScribeAI] Tauri Desktop Shell Initialized.");
            println!("[MedScribeAI] Sovereign local backend sidecar target: 127.0.0.1:8000.");

            match app.shell().sidecar("medscribe-backend") {
                Ok(cmd) => match cmd.spawn() {
                    Ok((mut rx, child)) => {
                        let pid = child.pid();
                        println!("[MedScribeAI] Backend sidecar spawned successfully (PID: {}).", pid);
                        if let Ok(mut lock) = child_arc_setup.lock() {
                            *lock = Some(child);
                        }
                        tauri::async_runtime::spawn(async move {
                            while let Some(_event) = rx.recv().await {
                                // output stream consumed
                            }
                        });
                    }
                    Err(err) => {
                        eprintln!("[MedScribeAI] Note: Sidecar binary not spawned by Tauri: {}. Continuing in standalone/external mode.", err);
                    }
                },
                Err(err) => {
                    eprintln!("[MedScribeAI] Note: Sidecar command definition: {}. Continuing.", err);
                }
            }

            Ok(())
        })
        .on_window_event(move |_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Ok(mut lock) = child_arc_window.lock() {
                    if let Some(child) = lock.take() {
                        let pid = child.pid();
                        println!("[MedScribeAI] Terminating sidecar child PID {} on window destroy...", pid);
                        let _ = child.kill();
                    }
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building MedScribeAI tauri desktop application")
        .run(move |_app_handle, event| {
            match event {
                tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
                    if let Ok(mut lock) = child_arc_exit.lock() {
                        if let Some(child) = lock.take() {
                            let pid = child.pid();
                            println!("[MedScribeAI] Terminating sidecar child PID {} on app exit...", pid);
                            let _ = child.kill();
                        }
                    }
                }
                _ => {}
            }
        });
}
