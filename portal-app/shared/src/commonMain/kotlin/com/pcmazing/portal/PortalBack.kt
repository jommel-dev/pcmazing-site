package com.pcmazing.portal

import androidx.compose.runtime.Composable

@Composable
expect fun PortalBackHandler(enabled: Boolean = true, onBack: () -> Unit)
