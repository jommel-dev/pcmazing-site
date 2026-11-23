package com.pcmazing.portal.data

import android.content.Context

internal actual object PortalSession {
    private const val PREFS = "pcmazing_portal_session"
    private const val KEY = "user"

    actual fun read(): String? =
        PortalContext.app?.getSharedPreferences(PREFS, Context.MODE_PRIVATE)?.getString(KEY, null)

    actual fun write(value: String?) {
        val prefs = PortalContext.app?.getSharedPreferences(PREFS, Context.MODE_PRIVATE) ?: return
        prefs.edit().apply {
            if (value == null) remove(KEY) else putString(KEY, value)
        }.apply()
    }
}
