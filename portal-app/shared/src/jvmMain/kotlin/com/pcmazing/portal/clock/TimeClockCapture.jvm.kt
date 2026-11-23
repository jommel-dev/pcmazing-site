package com.pcmazing.portal.clock

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import java.awt.Desktop
import java.io.File

@Composable
actual fun rememberTimeClockActions(): TimeClockActions {
    return remember {
        TimeClockActions { _, onResult ->
            onResult(Result.failure(IllegalStateException("Selfie capture is available on the Android app.")))
        }
    }
}

actual fun openPdfBytes(filename: String, bytes: ByteArray): String? {
    val safe = filename.replace(Regex("[^A-Za-z0-9._-]"), "_").ifBlank { "payslip.pdf" }
    val file = File(System.getProperty("java.io.tmpdir"), safe)
    file.writeBytes(bytes)
    return try {
        Desktop.getDesktop().open(file)
        null
    } catch (_: Exception) {
        "Saved the PDF to ${file.absolutePath}"
    }
}
