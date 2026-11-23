package com.pcmazing.portal.data

import io.ktor.client.HttpClient

internal expect fun createPlatformHttpClient(): HttpClient
