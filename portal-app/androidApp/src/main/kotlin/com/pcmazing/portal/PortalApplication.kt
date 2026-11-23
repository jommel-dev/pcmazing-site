package com.pcmazing.portal

import android.app.Application
import com.pcmazing.portal.data.bindDevApiUrl
import com.pcmazing.portal.data.bindPortalContext

class PortalApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        bindPortalContext(this)
        bindDevApiUrl(BuildConfig.PORTAL_API_URL)
    }
}
