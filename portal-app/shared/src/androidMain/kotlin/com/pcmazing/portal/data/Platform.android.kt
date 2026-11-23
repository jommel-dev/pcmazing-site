package com.pcmazing.portal.data

import android.content.Context
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.get
import io.ktor.http.isSuccess
import java.util.concurrent.TimeUnit

internal object PortalContext {
    var app: Context? = null
}

fun bindPortalContext(context: Context) {
    PortalContext.app = context.applicationContext
}

internal object PortalApiRuntime {
    var overrideUrl: String? = null
    var preferredDevUrl: String? = null
}

fun bindDevApiUrl(url: String?) {
    PortalApiRuntime.preferredDevUrl = url?.trim()?.trimEnd('/')?.ifBlank { null }
}

actual fun portalApiBaseUrl(): String =
    PortalApiRuntime.overrideUrl ?: GENERATED_RELEASE_API_BASE_URL

actual suspend fun preparePortalApi(allowLocalApi: Boolean) {
    if (!allowLocalApi) {
        PortalApiRuntime.overrideUrl = null
        return
    }
    val candidates = (listOfNotNull(PortalApiRuntime.preferredDevUrl) + listOf(
        "http://10.0.2.2:3000",
        "http://10.0.2.2:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    )).distinct()
    for (url in candidates) {
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
