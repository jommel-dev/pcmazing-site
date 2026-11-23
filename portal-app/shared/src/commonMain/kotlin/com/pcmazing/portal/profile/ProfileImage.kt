package com.pcmazing.portal.profile

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.ImageBitmap

fun interface ProfileImagePicker {
    fun pick(onResult: (Result<ByteArray>) -> Unit)
}

@Composable
expect fun rememberProfileImagePicker(): ProfileImagePicker

expect fun decodeProfilePhoto(bytes: ByteArray): ImageBitmap?
