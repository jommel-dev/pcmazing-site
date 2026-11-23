package com.pcmazing.portal.profile

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import java.io.ByteArrayOutputStream

@Composable
actual fun rememberProfileImagePicker(): ProfileImagePicker {
    val context = LocalContext.current
    val pending = remember { mutableStateOf<((Result<ByteArray>) -> Unit)?>(null) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        val callback = pending.value
        pending.value = null
        if (callback == null) return@rememberLauncherForActivityResult
        if (uri == null) {
            callback(Result.failure(IllegalStateException("No photo selected.")))
            return@rememberLauncherForActivityResult
        }
        callback(runCatching { jpegUnderLimit(context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: error("Could not read that photo.")) })
    }
    return remember {
        ProfileImagePicker { onResult ->
            pending.value = onResult
            launcher.launch("image/*")
        }
    }
}

actual fun decodeProfilePhoto(bytes: ByteArray): ImageBitmap? =
    orientedBitmap(bytes)?.asImageBitmap()

private fun jpegUnderLimit(bytes: ByteArray): ByteArray {
    val source = orientedBitmap(bytes) ?: error("Choose a JPEG, PNG, or WEBP photo.")
    val longest = maxOf(source.width, source.height).coerceAtLeast(1)
    val scale = (1280f / longest).coerceAtMost(1f)
    val width = (source.width * scale).toInt().coerceAtLeast(1)
    val height = (source.height * scale).toInt().coerceAtLeast(1)
    val scaled = if (scale < 1f) Bitmap.createScaledBitmap(source, width, height, true) else source
    var quality = 85
    var output: ByteArray
    do {
        val stream = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, quality, stream)
        output = stream.toByteArray()
        quality -= 10
    } while (output.size > 1_800_000 && quality >= 40)
    if (output.size > 2 * 1024 * 1024) error("Profile photo must be 2 MB or smaller.")
    return output
}

private fun orientedBitmap(bytes: ByteArray): Bitmap? {
    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null
    val degrees = runCatching {
        when (ExifInterface(bytes.inputStream()).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> 0f
        }
    }.getOrDefault(0f)
    if (degrees == 0f) return bitmap
    val matrix = Matrix().apply { postRotate(degrees) }
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
}
