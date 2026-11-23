package com.pcmazing.portal.clock

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember

@Composable
actual fun rememberTimeClockActions(): TimeClockActions {
    return remember {
        TimeClockActions { _, onResult ->
            onResult(Result.failure(IllegalStateException("Selfie capture is available on the Android app.")))
        }
    }
}

actual fun openPdfBytes(filename: String, bytes: ByteArray): String? =
    "Payslip PDF opens on the Android app."
