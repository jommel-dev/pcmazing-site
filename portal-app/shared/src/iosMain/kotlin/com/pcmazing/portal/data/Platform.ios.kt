package com.pcmazing.portal.data

import io.ktor.client.HttpClient
import io.ktor.client.engine.darwin.Darwin
import io.ktor.client.plugins.HttpTimeout

internal object PortalApiRuntime {
    var overrideUrl: String? = null
}

actual fun portalApiBaseUrl(): String =
    PortalApiRuntime.overrideUrl ?: PRODUCTION_API_BASE_URL

actual suspend fun preparePortalApi(allowLocalApi: Boolean) {
    PortalApiRuntime.overrideUrl = if (allowLocalApi) "http://127.0.0.1:3000" else null
}

internal actual fun createPlatformHttpClient(): HttpClient = HttpClient(Darwin) {
    install(HttpTimeout) {
        connectTimeoutMillis = 15_000
        requestTimeoutMillis = 30_000
        socketTimeoutMillis = 30_000
    }
}
