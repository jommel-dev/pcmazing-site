package com.pcmazing.portal.data

expect fun portalApiBaseUrl(): String

expect suspend fun preparePortalApi(allowLocalApi: Boolean)
