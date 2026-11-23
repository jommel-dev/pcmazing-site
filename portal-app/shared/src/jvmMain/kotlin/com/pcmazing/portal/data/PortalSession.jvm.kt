package com.pcmazing.portal.data

import java.io.File

internal actual object PortalSession {
    private val file = File(System.getProperty("user.home"), ".pcmazing-portal-session.json")

    actual fun read(): String? = runCatching { file.takeIf { it.isFile }?.readText() }.getOrNull()

    actual fun write(value: String?) {
        if (value == null) {
            if (file.exists()) file.delete()
        } else {
            file.writeText(value)
        }
    }
}
