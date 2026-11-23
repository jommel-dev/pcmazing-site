package com.pcmazing.portal

import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application

fun main() = application {
    Window(
        onCloseRequest = ::exitApplication,
        title = "MyPeoplePortal",
    ) {
        App(allowLocalApi = true)
    }
}
