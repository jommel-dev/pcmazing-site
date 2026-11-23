import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.util.Properties

plugins {
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.composeCompiler)
}

val localProperties = Properties()
val localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localPropertiesFile.inputStream().use { localProperties.load(it) }
}
val devApiUrl = localProperties.getProperty("portal.api.url")?.trim()?.trimEnd('/').orEmpty()

dependencies {
    implementation(projects.shared)
    implementation(libs.androidx.activity.compose)
    implementation("androidx.core:core-ktx:1.15.0")
    implementation(libs.compose.foundation)
    implementation(libs.ktor.client.okhttp)
}

android {
    namespace = "com.pcmazing.portal"
    compileSdk = libs.versions.android.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "com.pcmazing.employeeportal"
        minSdk = libs.versions.android.minSdk.get().toInt()
        targetSdk = libs.versions.android.targetSdk.get().toInt()
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "PORTAL_API_URL", "\"$devApiUrl\"")
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    buildFeatures {
        buildConfig = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_11
    }
}

tasks.register<Copy>("publishDownloadApk") {
    from(layout.buildDirectory.file("outputs/apk/release/androidApp-release.apk"))
    into(rootProject.layout.projectDirectory.dir("../backend/downloads"))
    rename { "portal.apk" }
    duplicatesStrategy = DuplicatesStrategy.INCLUDE
}
tasks.configureEach {
    if (name == "packageRelease" || name == "assembleRelease") {
        finalizedBy("publishDownloadApk")
    }
    // Startup profiles are optional. On the Linux server this task dies with
    // "bad byte" while reading the release dex, which stops the APK.
    if (name.contains("ArtProfile")) {
        enabled = false
    }
}
