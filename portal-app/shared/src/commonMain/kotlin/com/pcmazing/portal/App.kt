package com.pcmazing.portal

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import com.pcmazing.portal.data.PortalApi
import com.pcmazing.portal.data.createPlatformHttpClient
import com.pcmazing.portal.ui.AdjustmentScreen
import com.pcmazing.portal.ui.AttendanceScreen
import com.pcmazing.portal.ui.ClockScreen
import com.pcmazing.portal.ui.DayScreen
import com.pcmazing.portal.ui.HomeGlance
import com.pcmazing.portal.ui.LoginScreen
import com.pcmazing.portal.ui.MemoListScreen
import com.pcmazing.portal.ui.MemoOverlay
import com.pcmazing.portal.ui.NotificationsScreen
import com.pcmazing.portal.ui.PayScreen
import com.pcmazing.portal.ui.PayslipScreen
import com.pcmazing.portal.ui.PortalBar
import com.pcmazing.portal.ui.PortalColors
import com.pcmazing.portal.ui.ProfileScreen
import com.pcmazing.portal.ui.SplashScreen
import com.pcmazing.portal.ui.TimesheetScreen
import com.pcmazing.portal.ui.WorkScreen

@Composable
fun App(allowLocalApi: Boolean = false) {
    val scope = rememberCoroutineScope()
    val portal = remember {
        PortalController(PortalApi(createPlatformHttpClient()), scope)
    }
    LaunchedEffect(allowLocalApi) {
        portal.start(allowLocalApi)
    }

    MaterialTheme(colorScheme = lightColorScheme(primary = PortalColors.Blue)) {
        val route = portal.route
        val showTabs = route == Route.Home || route == Route.Attendance || route == Route.Work || route == Route.Pay || route == Route.Profile
        PortalBackHandler(
            enabled = route != Route.Splash && route != Route.Login && route != Route.Home,
            onBack = portal::back,
        )
        Scaffold(
            containerColor = PortalColors.Page,
            bottomBar = {
                if (showTabs) PortalBar(route, portal.user?.role) { portal.tab(it) }
            },
        ) { padding ->
            Box(
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .background(PortalColors.Page),
            ) {
                when (val current = route) {
                    Route.Splash -> SplashScreen()
                    Route.Login -> LoginScreen(portal)
                    Route.Home -> HomeGlance(portal)
                    Route.Attendance -> AttendanceScreen(portal)
                    Route.Work -> WorkScreen(portal)
                    Route.Pay -> PayScreen(portal)
                    Route.Profile -> ProfileScreen(portal)
                    Route.Clock -> ClockScreen(portal)
                    Route.Memos -> MemoListScreen(portal)
                    Route.Notifications -> NotificationsScreen(portal)
                    Route.Timesheet -> TimesheetScreen(portal)
                    is Route.Day -> DayScreen(portal, current.date)
                    is Route.Payslip -> PayslipScreen(portal)
                    is Route.Adjust -> AdjustmentScreen(portal, current.attendanceId, current.workDate)
                }
                portal.pendingMemo?.let { memo ->
                    MemoOverlay(memo = memo, busy = portal.busy, error = portal.error, onAcknowledge = portal::acknowledgePending)
                }
                portal.viewingMemo?.let { memo ->
                    MemoOverlay(memo = memo, busy = false, error = null, acknowledgeLabel = "Close", onAcknowledge = { portal.viewingMemo = null })
                }
            }
        }
    }
}
