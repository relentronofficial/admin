import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    // START: FlutterFire Configuration
    id("com.google.gms.google-services")
    id("com.google.firebase.crashlytics")
    // END: FlutterFire Configuration
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Load signing config from android/key.properties (gitignored; set via CI secrets).
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.tamilbusinesstribe.tbt_app"
    // Pinned to 36 because flutter_webrtc requires it; SDK versions are
    // backward compatible, so overriding flutter.compileSdkVersion is safe.
    compileSdk = 36
    // Pinned to the highest NDK requested by any transitive plugin
    // (image_picker_android, livekit_client, video_player_android, ...).
    // NDK versions are backward compatible, so pinning to the highest is safe.
    ndkVersion = "27.0.12077973"

    compileOptions {
        // flutter_local_notifications 18+ uses java.time APIs that require
        // core library desugaring on API 26 and below. See:
        //   https://developer.android.com/studio/write/java8-support
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String?
            keyPassword = keystoreProperties["keyPassword"] as String?
            storeFile = (keystoreProperties["storeFile"] as String?)?.let { file(it) }
            storePassword = keystoreProperties["storePassword"] as String?
        }
    }

    defaultConfig {
        applicationId = "com.tamilbusinesstribe.tbt_app"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // Use release signing when key.properties is present; fall back to
            // debug keys only in local development without a keystore set up.
            signingConfig = if (keystorePropertiesFile.exists()) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }

            // R8 shrinks unused resources. Code minification is enabled —
            // verify with a release build before shipping if plugins add issues.
            isShrinkResources = true
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    // Required by flutter_local_notifications when core library desugaring
    // is enabled above. Version tracks Android Gradle Plugin 8.x guidance.
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
