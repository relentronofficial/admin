import com.android.build.gradle.LibraryExtension

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory = rootProject.layout.buildDirectory.dir("../../build").get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)

    // ── AGP 8 namespace defence for legacy Android library plugins ──────────
    //
    // AGP 8 requires every Android library module to declare `namespace` in
    // its build.gradle. Some old / abandoned plugins in the pub cache only
    // set `package="..."` in AndroidManifest.xml (the pre-AGP-7 convention)
    // and fail configuration with:
    //
    //   "Namespace not specified. Specify a namespace in the module's build
    //    file: <plugin>/android/build.gradle"
    //
    // Where possible, migrate to a maintained fork (e.g. better_player →
    // better_player_plus). For any residual legacy plugin, this shim
    // back-fills the namespace from the manifest's `package` attribute at
    // configuration time so the build proceeds.
    //
    // Registered *before* the evaluationDependsOn call below so the callback
    // is queued before any subproject evaluates.
    afterEvaluate {
        val libExt = extensions.findByType(LibraryExtension::class.java)
        if (libExt != null && libExt.namespace.isNullOrBlank()) {
            val manifestFile = file("src/main/AndroidManifest.xml")
            if (manifestFile.exists()) {
                val manifestText = manifestFile.readText()
                val pkgMatch = Regex("""package\s*=\s*"([^"]+)"""")
                    .find(manifestText)
                val pkg = pkgMatch?.groupValues?.getOrNull(1)
                if (!pkg.isNullOrBlank()) {
                    libExt.namespace = pkg
                    logger.warn(
                        "AGP 8 namespace shim: injected namespace=\"$pkg\" " +
                        "into legacy plugin :${project.name} (declared only in " +
                        "AndroidManifest.xml). Prefer migrating to a maintained " +
                        "fork long-term."
                    )
                }
            }
        }
    }

    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
