package com.pcmazing.portal.clock

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.location.Geocoder
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContract
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.pcmazing.portal.data.PortalContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.Locale

@Composable
actual fun rememberTimeClockActions(): TimeClockActions {
    val context = LocalContext.current
    val photoFile = remember {
        File(context.cacheDir, "selfies").apply { mkdirs() }
        File(File(context.cacheDir, "selfies"), "clock_selfie.jpg")
    }
    val photoUri = remember {
        FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", photoFile)
    }
    val pending = remember { mutableStateOf<((Result<StampedSelfie>) -> Unit)?>(null) }
    val pendingFetch = remember { mutableStateOf<ServerTimeFetch?>(null) }
    val locationListener = remember {
        object : LocationListener {
            override fun onLocationChanged(location: Location) = Unit
            @Deprecated("Deprecated in Java")
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
            override fun onProviderEnabled(provider: String) = Unit
            override fun onProviderDisabled(provider: String) = Unit
        }
    }

    DisposableEffect(Unit) {
        warmupLocation(context, locationListener)
        onDispose {
            val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
            runCatching { manager.removeUpdates(locationListener) }
        }
    }

    val cameraLauncher = rememberLauncherForActivityResult(FrontCameraTakePicture()) { shot ->
        val callback = pending.value
        val fetchServerTime = pendingFetch.value
        pending.value = null
        pendingFetch.value = null
        if (callback == null) return@rememberLauncherForActivityResult
        val bitmap = decodeCaptured(photoFile, shot.thumbnail)
        if (bitmap == null) {
            callback(Result.failure(IllegalStateException("Selfie was not captured")))
            return@rememberLauncherForActivityResult
        }
        var clock: ServerClock? = null
        var location: Location? = null
        var clockDone = false
        var locationDone = false
        fun finish() {
            if (!clockDone || !locationDone) return
            Thread {
                val stamped = stampProof(context, bitmap, location, clock)
                Handler(Looper.getMainLooper()).post { callback(Result.success(stamped)) }
            }.start()
        }
        awaitLocation(context, 8_000L) { fix ->
            location = fix
            locationDone = true
            finish()
        }
        val fetch = fetchServerTime
        if (fetch == null) {
            clockDone = true
            finish()
        } else {
            fetch.fetch { timeResult ->
                clock = timeResult.getOrNull()
                clockDone = true
                finish()
            }
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { grants ->
        val callback = pending.value
        val cameraOk = grants[Manifest.permission.CAMERA] == true || hasCamera(context)
        val locationOk = grants[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            grants[Manifest.permission.ACCESS_COARSE_LOCATION] == true ||
            hasLocation(context)
        if (!cameraOk || !locationOk) {
            pending.value = null
            pendingFetch.value = null
            callback?.invoke(
                Result.failure(
                    IllegalStateException(
                        if (!cameraOk) "Camera permission is required" else "Location permission is required",
                    ),
                ),
            )
            return@rememberLauncherForActivityResult
        }
        warmupLocation(context, locationListener)
        photoFile.delete()
        cameraLauncher.launch(photoUri)
    }

    return remember(cameraLauncher, permissionLauncher, photoUri) {
        TimeClockActions { fetchServerTime, onResult ->
            pendingFetch.value = fetchServerTime
            pending.value = onResult
            if (hasCamera(context) && hasLocation(context)) {
                warmupLocation(context, locationListener)
                photoFile.delete()
                cameraLauncher.launch(photoUri)
            } else {
                permissionLauncher.launch(
                    arrayOf(
                        Manifest.permission.CAMERA,
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                    ),
                )
            }
        }
    }
}

actual fun openPdfBytes(filename: String, bytes: ByteArray): String? {
    val context = PortalContext.app ?: return "Could not open the PDF."
    val safe = filename.replace(Regex("[^A-Za-z0-9._-]"), "_").ifBlank { "payslip.pdf" }
    val dir = File(context.cacheDir, "payslips").apply { mkdirs() }
    val file = File(dir, safe)
    file.writeBytes(bytes)
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, "application/pdf")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    return try {
        context.startActivity(intent)
        null
    } catch (_: Exception) {
        "No app is available to open the PDF."
    }
}

private data class CapturedShot(val accepted: Boolean, val thumbnail: Bitmap?)

private class FrontCameraTakePicture : ActivityResultContract<Uri, CapturedShot>() {
    override fun createIntent(context: Context, input: Uri): Intent {
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, input)
            putExtra("android.intent.extras.CAMERA_FACING", 1)
            putExtra("android.intent.extra.USE_FRONT_CAMERA", true)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY).forEach { info ->
            context.grantUriPermission(
                info.activityInfo.packageName,
                input,
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION,
            )
        }
        return intent
    }

    override fun parseResult(resultCode: Int, intent: Intent?): CapturedShot {
        val thumbnail = intent?.extras?.get("data") as? Bitmap
        return CapturedShot(resultCode == Activity.RESULT_OK || thumbnail != null, thumbnail)
    }
}

private fun hasCamera(context: Context) =
    ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

private fun hasLocation(context: Context) =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

private fun warmupLocation(context: Context, listener: LocationListener) {
    if (!hasLocation(context)) return
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER).forEach { provider ->
        runCatching {
            if (manager.isProviderEnabled(provider)) {
                manager.requestLocationUpdates(provider, 1_000L, 0f, listener, Looper.getMainLooper())
            }
        }
    }
}

private fun decodeCaptured(photoFile: File, thumbnail: Bitmap?): Bitmap? {
    if (photoFile.exists() && photoFile.length() > 0L) {
        decodeSelfie(photoFile.absolutePath)?.let { return it }
    }
    return thumbnail
}

private fun awaitLocation(context: Context, timeoutMs: Long, onResult: (Location?) -> Unit) {
    val recent = lastKnownLocation(context)?.takeIf { System.currentTimeMillis() - it.time < 120_000L }
    if (recent != null || !hasLocation(context)) {
        onResult(recent ?: lastKnownLocation(context))
        return
    }
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
        .filter { runCatching { manager.isProviderEnabled(it) }.getOrDefault(false) }
    if (providers.isEmpty()) {
        onResult(lastKnownLocation(context))
        return
    }
    val handler = Handler(Looper.getMainLooper())
    var done = false
    lateinit var listener: LocationListener
    fun complete(location: Location?) {
        if (done) return
        done = true
        handler.removeCallbacksAndMessages(null)
        runCatching { manager.removeUpdates(listener) }
        onResult(location ?: lastKnownLocation(context))
    }
    listener = object : LocationListener {
        override fun onLocationChanged(location: Location) = complete(location)
        @Deprecated("Deprecated in Java")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
        override fun onProviderEnabled(provider: String) = Unit
        override fun onProviderDisabled(provider: String) = Unit
    }
    providers.forEach { provider ->
        runCatching { manager.requestLocationUpdates(provider, 0L, 0f, listener, Looper.getMainLooper()) }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            runCatching {
                manager.getCurrentLocation(provider, null, ContextCompat.getMainExecutor(context)) { location ->
                    if (location != null) complete(location)
                }
            }
        }
    }
    handler.postDelayed({ complete(lastKnownLocation(context)) }, timeoutMs)
}

private fun lastKnownLocation(context: Context): Location? {
    if (!hasLocation(context)) return null
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    return listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER)
        .mapNotNull { provider -> runCatching { manager.getLastKnownLocation(provider) }.getOrNull() }
        .maxByOrNull { it.time }
}

private fun decodeSelfie(path: String): Bitmap? {
    val original = BitmapFactory.decodeFile(path) ?: return null
    val exif = runCatching { ExifInterface(path) }.getOrNull()
    val degrees = when (exif?.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
        else -> 0f
    }
    val rotated = if (degrees == 0f) original else {
        val matrix = Matrix().apply { postRotate(degrees) }
        Bitmap.createBitmap(original, 0, 0, original.width, original.height, matrix, true)
    }
    val maxWidth = 1600
    return if (rotated.width > maxWidth) {
        val scaledHeight = (rotated.height * (maxWidth.toFloat() / rotated.width)).toInt().coerceAtLeast(1)
        Bitmap.createScaledBitmap(rotated, maxWidth, scaledHeight, true)
    } else {
        rotated
    }
}

private fun stampProof(context: Context, source: Bitmap, location: Location?, clock: ServerClock?): StampedSelfie {
    val working = source.copy(Bitmap.Config.ARGB_8888, true) ?: source
    val address = location?.let { reverseGeocode(context, it) } ?: "Location unavailable"
    val lines = listOf(
        clock?.date ?: "Server date unavailable",
        clock?.time ?: "Server time unavailable",
        location?.let { "${"%.5f".format(Locale.US, it.latitude)}, ${"%.5f".format(Locale.US, it.longitude)}" }
            ?: "Location unavailable",
        address,
    )
    val canvas = Canvas(working)
    val textSize = (working.width / 28f).coerceIn(26f, 46f)
    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        this.textSize = textSize
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val lineHeight = textSize * 1.28f
    val blockHeight = lineHeight * lines.size + textSize
    val overlay = Paint().apply { color = Color.argb(170, 0, 0, 0) }
    canvas.drawRoundRect(RectF(16f, 16f, working.width - 16f, 16f + blockHeight), 18f, 18f, overlay)
    lines.forEachIndexed { index, line ->
        canvas.drawText(line.take(72), 32f, 16f + textSize + lineHeight * index, textPaint)
    }
    val jpeg = ByteArrayOutputStream()
    working.compress(Bitmap.CompressFormat.JPEG, 82, jpeg)
    var bytes = jpeg.toByteArray()
    if (bytes.size > 1_800_000) {
        jpeg.reset()
        working.compress(Bitmap.CompressFormat.JPEG, 60, jpeg)
        bytes = jpeg.toByteArray()
    }
    return StampedSelfie(
        image = working.asImageBitmap(),
        jpegBytes = bytes,
        latitude = location?.latitude ?: 0.0,
        longitude = location?.longitude ?: 0.0,
        placeName = address,
        hasFix = location != null,
    )
}

private fun reverseGeocode(context: Context, location: Location): String {
    val fallback = "Lat ${"%.5f".format(Locale.US, location.latitude)}, Lng ${"%.5f".format(Locale.US, location.longitude)}"
    return runCatching {
        val first = Geocoder(context, Locale.getDefault()).getFromLocation(location.latitude, location.longitude, 1)
            ?.firstOrNull() ?: return@runCatching fallback
        listOfNotNull(first.thoroughfare, first.locality, first.adminArea)
            .filter { it.isNotBlank() }
            .distinct()
            .joinToString(", ")
            .ifBlank { fallback }
    }.getOrNull() ?: fallback
}
