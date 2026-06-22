fn main() {
    #[cfg(target_os = "macos")]
    {
        cc::Build::new()
            .file("src/drop_view.m")
            .flag("-fobjc-arc")
            .flag("-fmodules")
            .compile("desk_drop_view");
        println!("cargo:rerun-if-changed=src/drop_view.m");
        println!("cargo:rustc-link-lib=framework=AppKit");
        println!("cargo:rustc-link-lib=framework=Foundation");
        println!("cargo:rustc-link-lib=framework=CoreServices");
    }

    tauri_build::build()
}
