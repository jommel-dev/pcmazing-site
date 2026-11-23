package com.pcmazing.portal.profile

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.toComposeImageBitmap
import org.jetbrains.skia.Image

@Composable
actual fun rememberProfileImagePicker(): ProfileImagePicker = remember {
    ProfileImagePicker { onResult ->
        onResult(Result.failure(IllegalStateException("Profile photo upload is available on the Android app.")))
    }
}

actual fun decodeProfilePhoto(bytes: ByteArray): ImageBitmap? =
    runCatching { Image.makeFromEncoded(bytes).toComposeImageBitmap() }.getOrNull()
