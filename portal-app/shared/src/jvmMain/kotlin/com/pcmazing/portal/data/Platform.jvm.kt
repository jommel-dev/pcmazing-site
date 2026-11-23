package com.pcmazing.portal.data

import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.get
import io.ktor.http.isSuccess
import java.io.File
import java.util.Properties
import java.util.concurrent.TimeUnit

internal object PortalApiRuntime {
    var overrideUrl: String? = null
}

actual fun portalApiBaseUrl(): String =
    PortalApiRuntime.overrideUrl ?: GENERATED_RELEASE_API_BASE_URL

actual suspend fun preparePortalApi(allowLocalApi: Boolean) {
    if (!allowLocalApi) {
        PortalApiRuntime.overrideUrl = null
        return
    }
    val candidates = listOfNotNull(readDevApiUrl()) + listOf(
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://localhost:3000",
        "http://localhost:3001",
    )
    for (url in candidates.distinct()) {
        if (localApiReachable(url)) {
            PortalApiRuntime.overrideUrl = url
            return
        }
    }
    PortalApiRuntime.overrideUrl = null
}

internal actual fun createPlatformHttpClient(): HttpClient = HttpClient(OkHttp) {
    install(HttpTimeout) {
        connectTimeoutMillis = 15_000
        requestTimeoutMillis = 30_000
        socketTimeoutMillis = 30_000
    }
}

private fun readDevApiUrl(): String? {
    val file = File("local.properties")
    if (!file.isFile) return null
    val properties = Properties()
    file.inputStream().use { properties.load(it) }
    return properties.getProperty("portal.api.url")?.trim()?.trimEnd('/')?.ifBlank { null }
}

private suspend fun localApiReachable(baseUrl: String): Boolean {
    val probe = HttpClient(OkHttp) {
        engine {
            config {
                connectTimeout(1500, TimeUnit.MILLISECONDS)
                readTimeout(2500, TimeUnit.MILLISECONDS)
            }
        }
    }
    return try {
        probe.get("$baseUrl/health").status.isSuccess()
    } catch (_: Throwable) {
        false
    } finally {
        probe.close()
    }
}
