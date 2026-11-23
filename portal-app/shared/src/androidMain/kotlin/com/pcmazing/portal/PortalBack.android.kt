package com.pcmazing.portal

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable

@Composable
actual fun PortalBackHandler(enabled: Boolean, onBack: () -> Unit) {
    BackHandler(enabled = enabled, onBack = onBack)
}
