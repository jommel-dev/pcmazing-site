package com.pcmazing.portal.data

import platform.Foundation.NSUserDefaults

internal actual object PortalSession {
    private const val KEY = "pcmazing_portal_session"

    actual fun read(): String? = NSUserDefaults.standardUserDefaults.stringForKey(KEY)

    actual fun write(value: String?) {
        val defaults = NSUserDefaults.standardUserDefaults
        if (value == null) defaults.removeObjectForKey(KEY) else defaults.setObject(value, forKey = KEY)
    }
}
