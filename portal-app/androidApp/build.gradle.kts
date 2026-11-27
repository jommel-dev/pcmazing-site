import org.gradle.api.DefaultTask
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.TaskAction
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Properties
import java.util.zip.Adler32
import java.util.zip.ZipFile

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
            excludes += "assets/dexopt/baseline.prof"
            excludes += "assets/dexopt/baseline.profm"
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

abstract class VerifyReleaseDex : DefaultTask() {
    @get:InputFile
    abstract val apk: RegularFileProperty

    @TaskAction
    fun verify() {
        ZipFile(apk.get().asFile).use { zip ->
            val dexes = zip.entries().toList().filter { it.name.matches(Regex("classes\\d*\\.dex")) }
            for (entry in dexes) {
                val bytes = zip.getInputStream(entry).readBytes()
                val stored = ByteBuffer.wrap(bytes, 8, 4).order(ByteOrder.LITTLE_ENDIAN).int.toLong() and 0xffffffffL
                val adler = Adler32()
                adler.update(bytes, 12, bytes.size - 12)
                if (stored != adler.value) {
                    throw GradleException(
                        "${entry.name} checksum is ${"%08x".format(stored)} but the file hashes to ${"%08x".format(adler.value)}. Android will close the app on launch. Run ./gradlew clean :androidApp:assembleRelease",
                    )
                }
            }
        }
    }
}

val releaseApk = layout.buildDirectory.file("outputs/apk/release/androidApp-release.apk")

tasks.register<VerifyReleaseDex>("verifyReleaseDex") {
    apk.set(releaseApk)
}

tasks.register<Copy>("publishDownloadApk") {
    from(releaseApk)
    into(rootProject.layout.projectDirectory.dir("../backend/downloads"))
    rename { "portal.apk" }
    duplicatesStrategy = DuplicatesStrategy.INCLUDE
}
tasks.configureEach {
    if (name == "packageRelease" || name == "assembleRelease") {
        finalizedBy("verifyReleaseDex")
    }
    if (name == "verifyReleaseDex") {
        finalizedBy("publishDownloadApk")
    }
    // Startup profiles are optional. On the Linux server this task dies with
    // "bad byte" while reading the release dex, which stops the APK.
    if (name.contains("ArtProfile")) {
        enabled = false
    }
}
