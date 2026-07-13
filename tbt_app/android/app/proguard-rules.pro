# Flutter — Dart AOT-compiled code is native; only plugin Java/Kotlin needs rules.
# Flutter's Gradle plugin injects its own keep rules automatically.

# WebRTC (LiveKit)
-keep class org.webrtc.** { *; }
-keepclassmembers class org.webrtc.** { *; }

# Socket.IO / OkHttp
-keep class io.socket.** { *; }
-dontwarn io.socket.**

# Livekit
-keep class livekit.org.** { *; }

# Firebase — each Firebase Gradle plugin ships its own consumer rules,
# but keep these as a safety net.
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**

# flutter_secure_storage
-keep class com.it_nomads.fluttersecurestorage.** { *; }

# Kotlin metadata (needed for coroutines reflection)
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
