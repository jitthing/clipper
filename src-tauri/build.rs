fn main() {
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rustc-link-lib=framework=Vision");
        println!("cargo:rustc-link-lib=framework=AppKit");
    }
    tauri_build::build()
}
