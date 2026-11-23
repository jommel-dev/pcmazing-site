package com.pcmazing.portal.clock

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.ImageBitmap

data class ServerClock(
    val iso: String,
    val date: String,
    val time: String,
)

data class StampedSelfie(
    val image: ImageBitmap,
    val jpegBytes: ByteArray,
    val latitude: Double,
    val longitude: Double,
    val placeName: String,
    val hasFix: Boolean,
)

fun interface ServerTimeFetch {
    fun fetch(onResult: (Result<ServerClock>) -> Unit)
}

fun interface TimeClockActions {
    fun captureSelfie(
        fetchServerTime: ServerTimeFetch,
        onResult: (Result<StampedSelfie>) -> Unit,
    )
}

@Composable
expect fun rememberTimeClockActions(): TimeClockActions

expect fun openPdfBytes(filename: String, bytes: ByteArray): String?
