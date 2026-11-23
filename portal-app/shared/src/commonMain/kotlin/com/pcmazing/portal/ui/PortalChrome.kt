package com.pcmazing.portal.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pcmazing.portal.PortalController
import com.pcmazing.portal.Route
import com.pcmazing.portal.generated.resources.Res
import com.pcmazing.portal.generated.resources.pcmazing_logo
import com.pcmazing.portal.generated.resources.portal_bell
import com.pcmazing.portal.generated.resources.portal_calendar
import com.pcmazing.portal.generated.resources.portal_check
import com.pcmazing.portal.generated.resources.portal_chevron
import com.pcmazing.portal.generated.resources.portal_clock
import com.pcmazing.portal.generated.resources.portal_eye
import com.pcmazing.portal.generated.resources.portal_home
import com.pcmazing.portal.generated.resources.portal_logout
import com.pcmazing.portal.generated.resources.portal_nav_clock
import com.pcmazing.portal.generated.resources.portal_nav_user
import com.pcmazing.portal.generated.resources.portal_nav_wallet
import com.pcmazing.portal.generated.resources.portal_payslip
import com.pcmazing.portal.generated.resources.portal_settings
import com.pcmazing.portal.generated.resources.portal_timesheet
import com.pcmazing.portal.generated.resources.portal_wallet
import org.jetbrains.compose.resources.DrawableResource
import org.jetbrains.compose.resources.painterResource

object PortalColors {
    val Page = Color(0xFFF8FAFC)
    val Ink = Color(0xFF0F172A)
    val Muted = Color(0xFF64748B)
    val Blue = Color(0xFF2563EB)
    val Halo = Color(0xFFEFF6FF)
    val Line = Color(0xFFE2E8F0)
    val Field = Color(0xFFF8FAFC)
    val Danger = Color(0xFFBE123C)
    val White = Color.White
    val Green = Color(0xFF047857)
    val GreenWash = Color(0xFFECFDF5)
    val Amber = Color(0xFFB45309)
    val AmberWash = Color(0xFFFFFBEB)
    val Track = Color(0xFFE0F2FE)
}

@Composable
fun SplashScreen() {
    Column(
        Modifier.fillMaxSize().background(PortalColors.Page).statusBarsPadding().navigationBarsPadding(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(
            Modifier.weight(1f).fillMaxWidth().padding(horizontal = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            BrandLogo(width = 248.dp, height = 72.dp, halo = true)
            Spacer(Modifier.height(24.dp))
            Text("MyPeoplePortal", color = PortalColors.Ink, fontSize = 32.sp, fontWeight = FontWeight.Bold, letterSpacing = (-1.2).sp)
            Spacer(Modifier.height(10.dp))
            Text("Employee portal", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(10.dp))
            Text(
                "We Build It Better!",
                color = PortalColors.Muted,
                fontSize = 14.sp,
                lineHeight = 21.sp,
                textAlign = TextAlign.Center,
            )
        }
        Column(
            Modifier.padding(bottom = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Dot(PortalColors.Blue.copy(alpha = 0.35f))
                Dot(PortalColors.Blue)
                Dot(PortalColors.Blue.copy(alpha = 0.35f))
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                PortalLock()
                Text("Your personal employee workspace", color = PortalColors.Muted, fontSize = 12.sp)
            }
        }
    }
}

@Composable
fun LoginScreen(portal: PortalController) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var forgotHint by remember { mutableStateOf(false) }
    val passwordFocus = remember { FocusRequester() }

    Column(
        Modifier
            .fillMaxSize()
            .background(PortalColors.Page)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp),
    ) {
        Spacer(Modifier.height(28.dp))
        BrandLogo(width = 210.dp, height = 60.dp, halo = false)
        Spacer(Modifier.height(10.dp))
        Text("MyPeoplePortal", color = PortalColors.Ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(22.dp))
        Text("Welcome back", color = PortalColors.Ink, fontSize = 28.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.6).sp)
        Spacer(Modifier.height(8.dp))
        Text(
            "Sign in to manage your pay, attendance and time clock.",
            color = PortalColors.Muted,
            fontSize = 14.sp,
            lineHeight = 20.sp,
        )
        Spacer(Modifier.height(22.dp))
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).border(1.dp, PortalColors.Line, RoundedCornerShape(20.dp)).background(PortalColors.White).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            AuthField(
                label = "Username",
                value = username,
                onValueChange = { username = it; portal.error = null },
                placeholder = "Enter your username",
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                keyboardActions = KeyboardActions(onNext = { passwordFocus.requestFocus() }),
            )
            AuthField(
                label = "Password",
                value = password,
                onValueChange = { password = it; portal.error = null },
                placeholder = "Enter password",
                focusRequester = passwordFocus,
                visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { portal.login(username, password) }),
                trailing = if (showPassword) "HIDE" else "SHOW",
                onTrailing = { showPassword = !showPassword },
            )
            Text(
                "Forgot password?",
                color = PortalColors.Blue,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.align(Alignment.End).clickable { forgotHint = !forgotHint },
            )
            if (forgotHint) {
                Text("Ask an administrator to reset your password.", color = PortalColors.Muted, fontSize = 12.sp, modifier = Modifier.align(Alignment.End))
            }
            if (!portal.error.isNullOrBlank()) {
                Text(portal.error.orEmpty(), color = PortalColors.Danger, fontSize = 13.sp)
            }
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (portal.busy) PortalColors.Blue.copy(alpha = 0.7f) else PortalColors.Blue)
                    .clickable(enabled = !portal.busy) { portal.login(username, password) },
                contentAlignment = Alignment.Center,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("→", color = PortalColors.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                    Text(if (portal.busy) "Signing in…" else "Sign in", color = PortalColors.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
        Spacer(Modifier.height(22.dp))
        Text("Use the account provided by PCmazing.", color = PortalColors.Muted, fontSize = 13.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            Text("Need access? ", color = PortalColors.Muted, fontSize = 13.sp)
            Text("Contact your administrator", color = PortalColors.Blue, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(16.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            PortalLock()
            Spacer(Modifier.width(6.dp))
            Text("Keep your sign-in details private.", color = PortalColors.Muted, fontSize = 12.sp)
        }
        Spacer(Modifier.height(28.dp))
        Text(portal.apiBase, color = PortalColors.Muted, fontSize = 11.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
fun HomeGlance(portal: PortalController) {
    val data = portal.dashboard
    val name = portal.user?.fullName?.ifBlank { portal.user?.username } ?: "there"
    val first = name.substringBefore(' ')
    val hours = data?.monthSummary?.totalHours ?: 0.0
    val target = 80.0
    val ratio = (hours / target).coerceIn(0.0, 1.0).toFloat()
    val pay = data?.payslips?.firstOrNull()?.estimatedPay
    var hidden by remember { mutableStateOf(false) }
    val timedIn = !data?.today?.timeIn.isNullOrBlank()

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp)) {
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(42.dp).clip(CircleShape).background(PortalColors.Halo), contentAlignment = Alignment.Center) {
                val photo = portal.avatar
                if (photo != null) {
                    Image(photo, contentDescription = "Profile photo", modifier = Modifier.fillMaxSize().clip(CircleShape), contentScale = ContentScale.Crop)
                } else {
                    Text(first.take(1).uppercase(), color = PortalColors.Blue, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.size(12.dp))
            Column(Modifier.weight(1f)) {
                Text("Good day, $first", color = PortalColors.Muted, fontSize = 13.sp)
                Spacer(Modifier.height(5.dp))
                Text(name, color = PortalColors.Ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
            }
            Box(Modifier.size(40.dp).clickable { portal.open(Route.Notifications) }, contentAlignment = Alignment.Center) {
                PortalIcon(Res.drawable.portal_bell, 22.dp)
                if (portalNotices(portal).any { it.id !in portal.readNotices }) {
                    Box(Modifier.align(Alignment.TopEnd).padding(8.dp).size(8.dp).clip(CircleShape).background(Color(0xFFEF4444)))
                }
            }
            Box(Modifier.size(40.dp).clickable { portal.tab(Route.Profile) }, contentAlignment = Alignment.Center) {
                PortalIcon(Res.drawable.portal_settings, 22.dp, PortalColors.Ink)
            }
        }
        Spacer(Modifier.height(22.dp))
        Text("Your work, at a glance", color = PortalColors.Ink, fontSize = 28.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.9).sp)
        if (!portal.error.isNullOrBlank()) {
            Spacer(Modifier.height(12.dp))
            Text(portal.error.orEmpty(), color = PortalColors.Danger, fontSize = 13.sp)
        }
        if (!portal.notice.isNullOrBlank()) {
            Spacer(Modifier.height(8.dp))
            Text(portal.notice.orEmpty(), color = PortalColors.Green, fontSize = 13.sp)
        }
        Spacer(Modifier.height(22.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            PortalIcon(Res.drawable.portal_calendar, 15.dp)
            Spacer(Modifier.size(7.dp))
            Text(data?.workDate ?: portal.month, color = PortalColors.Muted, fontSize = 12.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
            Text(
                "THIS MONTH",
                color = PortalColors.Blue,
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clip(RoundedCornerShape(100.dp)).background(PortalColors.Halo).padding(horizontal = 8.dp, vertical = 4.dp),
            )
        }
        Spacer(Modifier.height(14.dp))
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).border(1.dp, PortalColors.Line, RoundedCornerShape(20.dp)).background(PortalColors.White).clickable { portal.tab(Route.Attendance) }.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconBadge(Res.drawable.portal_clock, PortalColors.Halo)
                Spacer(Modifier.size(10.dp))
                Text("Worked hours", color = PortalColors.Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                PortalIcon(Res.drawable.portal_chevron, 16.dp)
            }
            Row(verticalAlignment = Alignment.Bottom) {
                Text(trimHours(hours), color = PortalColors.Ink, fontSize = 34.sp, fontWeight = FontWeight.Bold, letterSpacing = (-1).sp)
                Text(" / ${target.toInt()} hrs", color = PortalColors.Muted, fontSize = 17.sp, modifier = Modifier.padding(bottom = 4.dp))
            }
            Box(Modifier.fillMaxWidth().height(7.dp).clip(RoundedCornerShape(100.dp)).background(PortalColors.Track)) {
                Box(Modifier.fillMaxWidth(ratio).height(7.dp).clip(RoundedCornerShape(100.dp)).background(PortalColors.Blue))
            }
            Row {
                Text("${data?.monthSummary?.daysPresent ?: 0} days present", color = PortalColors.Muted, fontSize = 12.sp, modifier = Modifier.weight(1f))
                Text("${(ratio * 100).toInt()}%", color = PortalColors.Blue, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        Spacer(Modifier.height(14.dp))
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).border(1.dp, PortalColors.Line, RoundedCornerShape(20.dp)).background(PortalColors.White).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconBadge(Res.drawable.portal_wallet, PortalColors.Track)
                Spacer(Modifier.size(10.dp))
                Text("Latest payslip", color = PortalColors.Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Box(Modifier.clickable { hidden = !hidden }) { PortalIcon(Res.drawable.portal_eye, 19.dp) }
            }
            Text(
                if (hidden) "₱••••" else if (pay == null) "—" else com.pcmazing.portal.formatMoney(pay),
                color = PortalColors.Ink,
                fontSize = 36.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-1.2).sp,
            )
            Text("Estimate from your latest payslip", color = PortalColors.Muted, fontSize = 12.sp)
        }
        Spacer(Modifier.height(25.dp))
        Text("Quick actions", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(15.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            QuickAction(Res.drawable.portal_clock, "Time clock") { portal.open(Route.Clock) }
            QuickAction(Res.drawable.portal_payslip, "Payslips") { portal.tab(Route.Pay) }
            QuickAction(Res.drawable.portal_calendar, "Attendance") { portal.tab(Route.Attendance) }
            QuickAction(Res.drawable.portal_timesheet, "Timesheet") { portal.open(Route.Timesheet) }
        }
        Spacer(Modifier.height(25.dp))
        Text("Today", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).border(1.dp, PortalColors.Line, RoundedCornerShape(16.dp)).background(PortalColors.White).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(7.dp).clip(CircleShape).background(if (timedIn) PortalColors.Green else PortalColors.Muted))
                Spacer(Modifier.size(7.dp))
                Text(
                    portal.clock?.message?.ifBlank { null } ?: if (timedIn) "Timed in" else "No punch yet",
                    color = if (timedIn) PortalColors.Green else PortalColors.Muted,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    PortalIcon(Res.drawable.portal_check, 12.dp, PortalColors.Green)
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(com.pcmazing.portal.formatManila(data?.today?.timeIn), color = PortalColors.Ink, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    Text("Time in", color = PortalColors.Muted, fontSize = 11.sp)
                }
                Row(
                    Modifier.clip(RoundedCornerShape(8.dp)).border(1.dp, Color(0xFFBFDBFE), RoundedCornerShape(8.dp)).clickable { portal.open(Route.Clock) }.padding(horizontal = 17.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PortalIcon(Res.drawable.portal_logout, 15.dp, PortalColors.Blue)
                    Spacer(Modifier.size(7.dp))
                    Text(if (portal.clock?.canTimeOut == true) "Time out" else "Time clock", color = PortalColors.Blue, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
        Spacer(Modifier.height(25.dp))
        Text("My requests", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        val requests = buildList {
            data?.overtimeNotice?.message?.takeIf { it.isNotBlank() }?.let { add(it to { portal.tab(Route.Attendance) }) }
            data?.adjustmentNotice?.message?.takeIf { it.isNotBlank() }?.let { add(it to { portal.tab(Route.Attendance) }) }
            val pendingMemos = portal.memos.count { it.acknowledgedAt.isNullOrBlank() }
            if (pendingMemos > 0) add("$pendingMemos memo${if (pendingMemos == 1) "" else "s"} waiting for acknowledgement" to { portal.open(Route.Memos) })
            val offs = data?.monthSummary?.dayOffCount ?: 0
            if (offs > 0) add("$offs day off${if (offs == 1) "" else "s"} this month" to { portal.tab(Route.Attendance) })
        }
        if (requests.isEmpty()) {
            Text("No requests yet.", color = PortalColors.Muted, fontSize = 13.sp)
        } else {
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).border(1.dp, PortalColors.Line, RoundedCornerShape(16.dp)).background(PortalColors.White)) {
                requests.forEachIndexed { index, (label, open) ->
                    if (index > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(PortalColors.Line))
                    Row(Modifier.fillMaxWidth().clickable { open() }.padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(label, color = PortalColors.Ink, fontSize = 13.sp, modifier = Modifier.weight(1f))
                        PortalIcon(Res.drawable.portal_chevron, 16.dp)
                    }
                }
            }
        }
        Spacer(Modifier.height(28.dp))
    }
}

@Composable
fun PortalBar(selected: Route, role: String?, onSelect: (Route) -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(PortalColors.White).border(1.dp, PortalColors.Line).navigationBarsPadding().padding(top = 10.dp, bottom = 8.dp),
    ) {
        NavItem("Home", Res.drawable.portal_home, selected == Route.Home) { onSelect(Route.Home) }
        NavItem(workTrackLabel(role), Res.drawable.portal_check, selected == Route.Work) { onSelect(Route.Work) }
        NavItem("Pay", Res.drawable.portal_nav_wallet, selected == Route.Pay) { onSelect(Route.Pay) }
        NavItem("Profile", Res.drawable.portal_nav_user, selected == Route.Profile) { onSelect(Route.Profile) }
    }
}

internal enum class WorkTrack { Quota, Tasks, Progress }

internal fun workTrack(role: String?): WorkTrack {
    val key = role.orEmpty().lowercase().filter { it.isLetterOrDigit() }
    return when {
        key.contains("ojt") || key.contains("intern") || key.contains("trainee") -> WorkTrack.Progress
        key == "developer" || key == "developers" -> WorkTrack.Tasks
        key.contains("technician") || key.contains("sales") || key == "manager" || key == "assistantmanager" || key == "assistantsalesmanager" -> WorkTrack.Quota
        else -> WorkTrack.Progress
    }
}

internal fun workTrackLabel(role: String?): String = when (workTrack(role)) {
    WorkTrack.Quota -> "Quota"
    WorkTrack.Tasks -> "Tasks"
    WorkTrack.Progress -> "Progress"
}

internal fun isOjtRole(role: String?): Boolean {
    val key = role.orEmpty().lowercase().filter { it.isLetterOrDigit() }
    return key.contains("ojt") || key.contains("intern") || key.contains("trainee")
}

@Composable
private fun RowScope.NavItem(label: String, icon: DrawableResource, active: Boolean, onClick: () -> Unit) {
    Column(Modifier.weight(1f).clickable(onClick = onClick), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier.size(width = 54.dp, height = 29.dp).clip(RoundedCornerShape(100.dp)).background(if (active) PortalColors.Halo else PortalColors.White),
            contentAlignment = Alignment.Center,
        ) {
            PortalIcon(icon, 21.dp, if (active) PortalColors.Blue else PortalColors.Muted)
        }
        Spacer(Modifier.height(5.dp))
        Text(label, color = if (active) PortalColors.Blue else PortalColors.Muted, fontSize = 10.sp, fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium)
    }
}

@Composable
private fun QuickAction(icon: DrawableResource, label: String, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(72.dp).clickable(onClick = onClick)) {
        Box(Modifier.size(52.dp).clip(RoundedCornerShape(16.dp)).background(PortalColors.White).border(1.dp, PortalColors.Line, RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) {
            PortalIcon(icon, 22.dp, PortalColors.Blue)
        }
        Spacer(Modifier.height(8.dp))
        Text(label, color = PortalColors.Ink, fontSize = 11.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center)
    }
}

@Composable
private fun BrandLogo(width: Dp, height: Dp, halo: Boolean) {
    val image = @Composable {
        Image(
            painter = painterResource(Res.drawable.pcmazing_logo),
            contentDescription = "PCmazing logo",
            contentScale = ContentScale.Fit,
            modifier = Modifier.width(width).height(height).clip(RoundedCornerShape(if (halo) 16.dp else 14.dp)).background(PortalColors.White),
        )
    }
    if (halo) {
        Box(Modifier.clip(RoundedCornerShape(100.dp)).background(PortalColors.Halo).padding(horizontal = 18.dp, vertical = 16.dp)) { image() }
    } else {
        Box(
            Modifier.clip(RoundedCornerShape(14.dp)).border(1.dp, PortalColors.Line, RoundedCornerShape(14.dp)).background(PortalColors.White).padding(horizontal = 12.dp, vertical = 8.dp),
        ) { image() }
    }
}

@Composable
private fun AuthField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    focusRequester: FocusRequester? = null,
    trailing: String? = null,
    onTrailing: (() -> Unit)? = null,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(label, color = PortalColors.Ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        Row(
            Modifier.fillMaxWidth().height(48.dp).clip(RoundedCornerShape(12.dp)).background(PortalColors.Field).border(1.dp, PortalColors.Line, RoundedCornerShape(12.dp)).padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                textStyle = TextStyle(color = PortalColors.Ink, fontSize = 14.sp),
                visualTransformation = visualTransformation,
                keyboardOptions = keyboardOptions,
                keyboardActions = keyboardActions,
                modifier = Modifier.weight(1f).then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier),
                decorationBox = { inner ->
                    Box(contentAlignment = Alignment.CenterStart) {
                        if (value.isEmpty()) Text(placeholder, color = PortalColors.Muted, fontSize = 14.sp)
                        inner()
                    }
                },
            )
            if (trailing != null && onTrailing != null) {
                Text(trailing, color = PortalColors.Muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable(onClick = onTrailing))
            }
        }
    }
}

@Composable
internal fun IconBadge(icon: DrawableResource, wash: Color) {
    Box(Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).background(wash), contentAlignment = Alignment.Center) {
        PortalIcon(icon, 18.dp, PortalColors.Blue)
    }
}

@Composable
internal fun PortalIcon(resource: DrawableResource, size: Dp, tint: Color = PortalColors.Muted) {
    Image(painterResource(resource), contentDescription = null, modifier = Modifier.size(size), contentScale = ContentScale.Fit, colorFilter = ColorFilter.tint(tint))
}

@Composable
private fun PortalLock() {
    Canvas(Modifier.size(13.dp)) {
        val stroke = Stroke(width = 1.2.dp.toPx())
        drawRoundRect(
            color = PortalColors.Muted,
            topLeft = Offset(size.width * 0.18f, size.height * 0.42f),
            size = Size(size.width * 0.64f, size.height * 0.48f),
            cornerRadius = CornerRadius(1.6.dp.toPx()),
            style = stroke,
        )
        drawArc(
            color = PortalColors.Muted,
            startAngle = 200f,
            sweepAngle = 140f,
            useCenter = false,
            topLeft = Offset(size.width * 0.28f, size.height * 0.06f),
            size = Size(size.width * 0.44f, size.height * 0.46f),
            style = stroke,
        )
    }
}

@Composable
private fun Dot(color: Color) {
    Box(Modifier.size(6.dp).clip(CircleShape).background(color))
}

private fun trimHours(value: Double): String {
    val text = ((kotlin.math.round(value * 10.0)) / 10.0).toString()
    return text.trimEnd('0').trimEnd('.')
}
