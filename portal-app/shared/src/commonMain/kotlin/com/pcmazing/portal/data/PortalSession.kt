package com.pcmazing.portal.data

internal expect object PortalSession {
    fun read(): String?
    fun write(value: String?)
}

object PortalSessionStore {
    fun load(): PortalUser? {
        val raw = PortalSession.read()?.takeIf { it.isNotBlank() } ?: return null
        return runCatching { portalJson.decodeFromString<PortalUser>(raw) }
            .getOrNull()
            ?.takeIf { it.accessToken.isNotBlank() }
    }

    fun save(user: PortalUser) {
        if (user.accessToken.isBlank()) return
        PortalSession.write(portalJson.encodeToString(user))
    }

    fun clear() {
        PortalSession.write(null)
    }
}

internal fun jwtExpiryMillis(token: String): Long? {
    val payload = token.split('.').getOrNull(1) ?: return null
    val decoded = runCatching { decodeBase64Url(payload) }.getOrNull() ?: return null
    val match = Regex(""""exp"\s*:\s*(\d+)""").find(decoded) ?: return null
    return match.groupValues[1].toLongOrNull()?.times(1000)
}

private fun decodeBase64Url(value: String): String {
    val padded = value.replace('-', '+').replace('_', '/')
        .let { raw -> raw + "=".repeat((4 - raw.length % 4) % 4) }
    val bytes = kotlin.io.encoding.Base64.decode(padded)
    return bytes.decodeToString()
}
