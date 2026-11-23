package com.pcmazing.portal.data

internal const val PRODUCTION_API_BASE_URL = "https://v1-api.pcmazing.com"

expect fun portalApiBaseUrl(): String

expect suspend fun preparePortalApi(allowLocalApi: Boolean)
