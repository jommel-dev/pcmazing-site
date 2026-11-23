package com.pcmazing.portal.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pcmazing.portal.PortalController
import com.pcmazing.portal.Route
import com.pcmazing.portal.clock.ServerClock
import com.pcmazing.portal.clock.ServerTimeFetch
import com.pcmazing.portal.clock.StampedSelfie
import com.pcmazing.portal.clock.rememberTimeClockActions
import com.pcmazing.portal.data.AttendanceDay
import com.pcmazing.portal.data.MemoDetail
import com.pcmazing.portal.daysInMonth
import com.pcmazing.portal.formatHours
import com.pcmazing.portal.formatManila
import com.pcmazing.portal.formatMoney
import com.pcmazing.portal.generated.resources.Res
import com.pcmazing.portal.generated.resources.portal_bell
import com.pcmazing.portal.generated.resources.portal_calendar
import com.pcmazing.portal.generated.resources.portal_check
import com.pcmazing.portal.generated.resources.portal_clock
import com.pcmazing.portal.generated.resources.portal_chevron
import com.pcmazing.portal.generated.resources.portal_download
import com.pcmazing.portal.generated.resources.portal_eye
import com.pcmazing.portal.generated.resources.portal_logout
import com.pcmazing.portal.generated.resources.portal_payslip
import com.pcmazing.portal.generated.resources.portal_person
import com.pcmazing.portal.generated.resources.portal_pin
import com.pcmazing.portal.generated.resources.portal_settings
import com.pcmazing.portal.generated.resources.portal_shield
import com.pcmazing.portal.generated.resources.portal_timesheet
import com.pcmazing.portal.generated.resources.portal_wallet
import com.pcmazing.portal.monthTitle
import com.pcmazing.portal.profile.rememberProfileImagePicker
import com.pcmazing.portal.weekdaySunday0
import kotlin.math.round
import org.jetbrains.compose.resources.painterResource

@Composable
internal fun AttendanceScreen(portal: PortalController) {
    val data = portal.dashboard
    val clock = portal.clock
    val today = data?.today
    val name = portal.user?.fullName?.ifBlank { portal.user?.username } ?: "there"
    val first = name.substringBefore(' ')
    val clockedIn = !today?.timeIn.isNullOrBlank() && today?.timeOut.isNullOrBlank()
    val clockedOut = !today?.timeOut.isNullOrBlank()
    var showAll by remember { mutableStateOf(false) }
    val todayKey = data?.workDate?.take(10).orEmpty()
    val records = data?.attendanceDays.orEmpty().sortedByDescending { it.workDate }
    val visible = if (showAll) records else records.take(4)
    val missing = records.count { !it.timeIn.isNullOrBlank() && it.timeOut.isNullOrBlank() && it.workDate.take(10) != todayKey }
    val place = clock?.expectedLocation?.ifBlank { null } ?: "Workplace"
    Screen {
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
                Text(name, color = PortalColors.Ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
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
        Text("Attendance", color = PortalColors.Ink, fontSize = 28.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.9).sp)
        Spacer(Modifier.height(6.dp))
        Text("Selfie and location for time in and time out.", color = PortalColors.Muted, fontSize = 14.sp)
        Spacer(Modifier.height(18.dp))
        Messages(portal)
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Today", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Text(formatManila(clock?.serverNow ?: data?.workDate, withDate = true), color = PortalColors.Muted, fontSize = 13.sp)
        }
        Spacer(Modifier.height(12.dp))
        Column(Modifier.card(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(if (clockedIn || clockedOut) PortalColors.Green else PortalColors.Muted))
                Spacer(Modifier.size(8.dp))
                Text(
                    when {
                        clockedIn -> "You're clocked in"
                        clockedOut -> "You're clocked out"
                        else -> "Not clocked in yet"
                    },
                    color = if (clockedIn || clockedOut) PortalColors.Green else PortalColors.Muted,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                )
                Spacer(Modifier.width(12.dp))
                PortalIcon(Res.drawable.portal_pin, 14.dp)
                Spacer(Modifier.size(4.dp))
                Text(place, color = PortalColors.Muted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            }
            Text(
                "A selfie is required before time in, and a new selfie before time out.",
                color = PortalColors.Muted,
                fontSize = 12.sp,
                lineHeight = 17.sp,
            )
            ProofRow(
                title = "TIME IN",
                value = if (today?.timeIn.isNullOrBlank()) "Selfie required" else formatManila(today?.timeIn),
                detail = if (today?.timeIn == null) "Coordinates are saved with the selfie" else "Selfie on file",
                place = if (today?.timeIn == null) "Address is saved with that selfie" else place,
                done = today?.timeIn != null,
            )
            Box(Modifier.fillMaxWidth().height(1.dp).background(PortalColors.Line))
            ProofRow(
                title = "TIME OUT",
                value = if (today?.timeOut.isNullOrBlank()) "Selfie required" else formatManila(today?.timeOut),
                detail = if (today?.timeOut == null) "New coordinates when you time out" else "Selfie on file",
                place = if (today?.timeOut == null) "Address is saved with that selfie" else place,
                done = today?.timeOut != null,
            )
            if (!clock?.lunchOut.isNullOrBlank() || !clock?.lunchIn.isNullOrBlank()) {
                Box(Modifier.fillMaxWidth().height(1.dp).background(PortalColors.Line))
                ProofRow(
                    title = "LUNCH",
                    value = "${formatManila(clock?.lunchOut)} – ${formatManila(clock?.lunchIn)}",
                    detail = if (clock?.lunchIn == null) "Lunch in still open" else "Lunch recorded",
                    place = place,
                    done = clock?.lunchIn != null,
                )
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(PortalColors.Line))
            OutlineAction(
                when {
                    today?.timeIn == null -> "Take selfie to time in"
                    today.timeOut == null -> "Take selfie to time out"
                    else -> "Review time clock"
                },
            ) { portal.open(Route.Clock) }
        }
        Spacer(Modifier.height(22.dp))
        Text("Attendance overview", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            PortalIcon(Res.drawable.portal_calendar, 15.dp)
            Spacer(Modifier.size(7.dp))
            Text(monthTitle(portal.month), color = PortalColors.Muted, fontSize = 12.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Badge("CURRENT CUT-OFF")
        }
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth().card(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Stat("${data?.monthSummary?.daysPresent ?: 0}", "Days present", PortalColors.Blue)
            Stat("${data?.monthSummary?.dayOffCount ?: 0}", "Day offs", PortalColors.Danger)
            Stat(missing.toString(), "Missing punches", Color(0xFFB45309))
        }
        Spacer(Modifier.height(8.dp))
        Text(
            when (missing) {
                0 -> "Includes today's active shift · No missing punches"
                1 -> "Includes today's active shift · 1 missing punch"
                else -> "Includes today's active shift · $missing missing punches"
            },
            color = PortalColors.Muted,
            fontSize = 12.sp,
        )
        Spacer(Modifier.height(22.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Daily records", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            if (records.size > 4) {
                Text(if (showAll) "Show less" else "View all", color = PortalColors.Blue, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable { showAll = !showAll })
            }
        }
        Spacer(Modifier.height(12.dp))
        if (records.isEmpty()) {
            Text("No attendance records yet.", color = PortalColors.Muted, fontSize = 13.sp)
        } else {
            Column(Modifier.card(4.dp)) {
                visible.forEachIndexed { index, row ->
                    if (index > 0) Box(Modifier.fillMaxWidth().padding(horizontal = 12.dp).height(1.dp).background(PortalColors.Line))
                    DailyRecord(row, todayKey) { portal.openDay(row.workDate.take(10)) }
                }
            }
        }
        Spacer(Modifier.height(16.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            Text("Something not right? ", color = PortalColors.Muted, fontSize = 13.sp)
            Text(
                "Request a correction",
                color = PortalColors.Blue,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable {
                    val fix = records.firstOrNull { it.canRequestTimeOutAdjustment && it.id != null }
                    if (fix?.id != null) portal.open(Route.Adjust(fix.id, fix.workDate.take(10)))
                    else portal.openDay(todayKey.ifBlank { portal.month + "-01" })
                },
            )
        }
        Spacer(Modifier.height(22.dp))
        MonthCalendar(portal)
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
internal fun DayScreen(portal: PortalController, date: String) {
    val data = portal.dashboard
    val day = data?.attendanceDays?.firstOrNull { it.workDate.take(10) == date }
    val off = data?.dayOffs?.firstOrNull { it.dayOffDate.take(10) == date }
    val todos = data?.todos?.filter { it.dueDate.take(10) == date }.orEmpty()
    val activities = data?.activities?.filter { it.createdAt.take(10) == date }.orEmpty()
    var reason by remember(date) { mutableStateOf(off?.reason.orEmpty()) }
    var todoTitle by remember(date) { mutableStateOf("") }
    Screen {
        Spacer(Modifier.height(8.dp))
        BackLink(portal::back)
        Spacer(Modifier.height(16.dp))
        Title(date, day?.let { "${formatManila(it.timeIn)} – ${formatManila(it.timeOut)}  ${formatHours(it.hoursWorked)}" } ?: "No punch")
        Spacer(Modifier.height(16.dp))
        Messages(portal)
        day?.let { punch ->
            Column(Modifier.card(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (!punch.overtimeStatus.isNullOrBlank()) Text("Overtime: ${punch.overtimeStatus}", color = PortalColors.Ink, fontSize = 13.sp)
                if (!punch.adjustmentStatus.isNullOrBlank()) Text("Time-out request: ${punch.adjustmentStatus}", color = PortalColors.Ink, fontSize = 13.sp)
                if (punch.canRequestOvertime && punch.id != null) {
                    BlueButton(if (portal.busy) "Saving…" else "Request overtime", enabled = !portal.busy) { portal.requestOvertime(punch) }
                }
                if (punch.canRequestTimeOutAdjustment && punch.id != null) {
                    OutlineAction("Request missed time-out") { portal.open(Route.Adjust(punch.id, date)) }
                }
            }
            Spacer(Modifier.height(14.dp))
        }
        Text("Day off", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Column(Modifier.card(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Field("Reason", reason, { reason = it }, "Why you are off")
            BlueButton(if (portal.busy) "Saving…" else "Save day off", enabled = !portal.busy) { portal.saveDayOff(date, reason) }
            if (off != null) {
                Text("Remove day off", color = PortalColors.Danger, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable { portal.removeDayOff(off.id) })
            }
        }
        Spacer(Modifier.height(22.dp))
        Text("Todos", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Column(Modifier.card(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (todos.isEmpty()) Text("Nothing due this day.", color = PortalColors.Muted, fontSize = 13.sp)
            todos.forEach { todo ->
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Box(
                        Modifier.size(22.dp).clip(RoundedCornerShape(6.dp)).border(1.dp, if (todo.isDone) PortalColors.Blue else PortalColors.Line, RoundedCornerShape(6.dp)).background(if (todo.isDone) PortalColors.Halo else PortalColors.White).clickable { portal.toggleTodo(todo.id, !todo.isDone) },
                        contentAlignment = Alignment.Center,
                    ) {
                        if (todo.isDone) Text("✓", color = PortalColors.Blue, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.size(10.dp))
                    Text(todo.title, color = PortalColors.Ink, fontSize = 14.sp, modifier = Modifier.weight(1f))
                    Text("Delete", color = PortalColors.Danger, fontSize = 12.sp, modifier = Modifier.clickable { portal.deleteTodo(todo.id) })
                }
            }
            Field("New todo", todoTitle, { todoTitle = it }, "Add a task")
            BlueButton("Add todo", enabled = !portal.busy && todoTitle.isNotBlank()) {
                portal.addTodo(date, todoTitle)
                todoTitle = ""
            }
        }
        if (activities.isNotEmpty()) {
            Spacer(Modifier.height(22.dp))
            Text("Activity", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(12.dp))
            Column(Modifier.card()) {
                activities.forEachIndexed { index, item ->
                    if (index > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(PortalColors.Line))
                    Column(Modifier.padding(vertical = 10.dp)) {
                        Text(item.title, color = PortalColors.Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        if (!item.details.isNullOrBlank()) Text(item.details, color = PortalColors.Muted, fontSize = 12.sp)
                    }
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
internal fun WorkScreen(portal: PortalController) {
    val role = portal.user?.role
    val track = workTrack(role)
    val data = portal.dashboard
    val todayKey = data?.workDate?.take(10).orEmpty()
    val days = data?.attendanceDays.orEmpty()
    val fullDays = days.count { !it.timeIn.isNullOrBlank() && !it.timeOut.isNullOrBlank() }
    val halfDays = days.count { day ->
        !day.timeIn.isNullOrBlank() && day.timeOut.isNullOrBlank() && day.workDate.take(10) != todayKey
    }
    val counted = fullDays * 8 + halfDays * 4
    Screen {
        Spacer(Modifier.height(8.dp))
        Title(
            workTrackLabel(role),
            when (track) {
                WorkTrack.Quota -> "Your monthly target from completed sales orders and job orders."
                WorkTrack.Tasks -> "Completed and in-progress work."
                WorkTrack.Progress -> if (isOjtRole(role)) "Training, tasks, and what you learned today." else "Monthly progress for your role."
            },
        )
        Spacer(Modifier.height(18.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            PortalIcon(Res.drawable.portal_calendar, 15.dp)
            Spacer(Modifier.size(7.dp))
            Text(monthTitle(portal.month), color = PortalColors.Muted, fontSize = 12.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
            Badge("THIS MONTH")
        }
        Spacer(Modifier.height(14.dp))
        when (track) {
            WorkTrack.Quota -> QuotaBody()
            WorkTrack.Tasks -> TasksBody()
            WorkTrack.Progress -> ProgressBody(isOjtRole(role), fullDays, halfDays, counted)
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun QuotaBody() {
    Column(Modifier.card(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Sales quota", color = PortalColors.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Text("No target is assigned for this month yet.", color = PortalColors.Muted, fontSize = 13.sp)
        Text("Admin sets the quota for Manager, Assistant Manager, and Technician from the sales orders and job orders they complete.", color = PortalColors.Muted, fontSize = 13.sp, lineHeight = 18.sp)
    }
}

@Composable
private fun TasksBody() {
    Column(Modifier.card(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Task progress", color = PortalColors.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Text("No tasks are linked to this account yet.", color = PortalColors.Muted, fontSize = 13.sp)
        Text("Completed and in-progress tasks will show here.", color = PortalColors.Muted, fontSize = 13.sp)
    }
}

@Composable
private fun ProgressBody(ojt: Boolean, fullDays: Int, halfDays: Int, counted: Int) {
    if (!ojt) {
        Column(Modifier.card(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Progress", color = PortalColors.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            Text("This tab follows the role. Sales sees a quota, developers see tasks, and OJT sees training progress and remaining hours.", color = PortalColors.Muted, fontSize = 13.sp, lineHeight = 18.sp)
        }
        return
    }
    Column(Modifier.card(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("OJT hours", color = PortalColors.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Text("The school allotment, such as 300 hours, is not on this account yet.", color = PortalColors.Muted, fontSize = 13.sp, lineHeight = 18.sp)
        Text("A finished day is 9 hours on site with a 1 hour lunch, so 8 hours are counted after time out. A missed time out counts as a half day, 4 hours.", color = PortalColors.Ink, fontSize = 13.sp, lineHeight = 18.sp)
    }
    Spacer(Modifier.height(12.dp))
    Row(Modifier.fillMaxWidth().card(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Stat(fullDays.toString(), "Full days", PortalColors.Blue)
        Stat(halfDays.toString(), "Half days", PortalColors.Amber)
        Stat(counted.toString(), "Hours counted", PortalColors.Ink)
    }
    Spacer(Modifier.height(8.dp))
    Text("Counted from this month's attendance. Hours are taken off the allotment only after time out.", color = PortalColors.Muted, fontSize = 12.sp)
}

@Composable
internal fun PayScreen(portal: PortalController) {
    val slips = portal.dashboard?.payslips.orEmpty()
    val latest = slips.firstOrNull()
    var hidden by remember { mutableStateOf(false) }
    var showAll by remember { mutableStateOf(false) }
    val history = if (showAll) slips else slips.take(3)
    Screen {
        Spacer(Modifier.height(8.dp))
        Title("Pay", "A clear view of your earnings.")
        Spacer(Modifier.height(18.dp))
        Messages(portal)
        Row(verticalAlignment = Alignment.CenterVertically) {
            PortalIcon(Res.drawable.portal_calendar, 15.dp)
            Spacer(Modifier.size(7.dp))
            Text(monthTitle(portal.month), color = PortalColors.Muted, fontSize = 12.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
            Badge("THIS MONTH")
        }
        Spacer(Modifier.height(14.dp))
        Column(Modifier.card(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconBadge(Res.drawable.portal_wallet, PortalColors.Track)
                Spacer(Modifier.size(10.dp))
                Text("Estimated compensation", color = PortalColors.Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Box(Modifier.clickable { hidden = !hidden }) { PortalIcon(Res.drawable.portal_eye, 19.dp) }
            }
            Text(
                if (hidden) "₱••••" else formatMoney(latest?.estimatedPay),
                color = PortalColors.Ink,
                fontSize = 36.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-1.2).sp,
            )
            Text(
                latest?.label?.ifBlank { null } ?: "No payslip has been released yet.",
                color = PortalColors.Muted,
                fontSize = 12.sp,
            )
        }
        Spacer(Modifier.height(10.dp))
        Text(
            "Estimates may change after payroll is finalized. Your final earnings appear on the payslip.",
            color = PortalColors.Muted,
            fontSize = 12.sp,
            lineHeight = 17.sp,
        )
        Spacer(Modifier.height(22.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Payslip history", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            if (slips.size > 3) {
                Text(if (showAll) "Show less" else "View all", color = PortalColors.Blue, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable { showAll = !showAll })
            }
        }
        Spacer(Modifier.height(12.dp))
        if (slips.isEmpty()) {
            Text("No payslip has been released yet.", color = PortalColors.Muted, fontSize = 13.sp)
        } else {
            Column(Modifier.card(8.dp)) {
                history.forEach { slip ->
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable { portal.openPayslip(slip.id) }.padding(horizontal = 8.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        IconBadge(Res.drawable.portal_payslip, PortalColors.Halo)
                        Spacer(Modifier.size(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(slip.label.ifBlank { "${slip.dateFrom} – ${slip.dateTo}" }, color = PortalColors.Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(
                                "${formatHours(slip.totalHours)} · ${if (hidden) "₱••••" else formatMoney(slip.estimatedPay)}",
                                color = PortalColors.Muted,
                                fontSize = 12.sp,
                            )
                        }
                        Box(Modifier.clickable { portal.openPayslip(slip.id) }) { PortalIcon(Res.drawable.portal_download, 18.dp) }
                    }
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
internal fun PayslipScreen(portal: PortalController) {
    val slip = portal.payslip
    Screen {
        Spacer(Modifier.height(8.dp))
        BackLink(portal::back)
        Spacer(Modifier.height(16.dp))
        if (portal.busy && slip == null) {
            CircularProgressIndicator(color = PortalColors.Blue)
        }
        Messages(portal)
        if (slip != null) {
            Title("Payslip", slip.label.ifBlank { "${slip.dateFrom} – ${slip.dateTo}" })
            Spacer(Modifier.height(8.dp))
            Text(slip.employee.fullName, color = PortalColors.Ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Text(listOfNotNull(slip.employee.positionTitle, slip.employee.department).joinToString(" · "), color = PortalColors.Muted, fontSize = 13.sp)
            Spacer(Modifier.height(16.dp))
            Column(Modifier.card(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Net pay", color = PortalColors.Muted, fontSize = 12.sp)
                Text(formatMoney(slip.breakdown?.netPay ?: slip.netPay ?: slip.totals.estimatedPay), color = PortalColors.Ink, fontSize = 32.sp, fontWeight = FontWeight.Bold)
                MoneyRow("Base pay", formatMoney(slip.totals.basePay))
                MoneyRow("Overtime", formatMoney(slip.totals.overtimePay))
                slip.breakdown?.let { breakdown ->
                    MoneyRow("Gross", formatMoney(breakdown.grossPay))
                    MoneyRow("Deductions", formatMoney(breakdown.totalDeductions), danger = true)
                }
                Text("${slip.totals.daysPresent} present · ${formatHours(slip.totals.totalHours)}", color = PortalColors.Muted, fontSize = 12.sp)
            }
            if (slip.lines.isNotEmpty()) {
                Spacer(Modifier.height(14.dp))
                Column(Modifier.card(0.dp).padding(horizontal = 16.dp)) {
                    slip.lines.forEachIndexed { index, line ->
                        if (index > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(PortalColors.Line))
                        MoneyRow(line.label.ifBlank { line.lineType }, formatMoney(line.amount))
                    }
                }
            }
            if (!slip.remarks.isNullOrBlank()) {
                Spacer(Modifier.height(12.dp))
                Text(slip.remarks, color = PortalColors.Muted, fontSize = 13.sp)
            }
            Spacer(Modifier.height(14.dp))
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { portal.includeRemarks = !portal.includeRemarks }) {
                Box(
                    Modifier.size(22.dp).clip(RoundedCornerShape(6.dp)).border(1.dp, if (portal.includeRemarks) PortalColors.Blue else PortalColors.Line, RoundedCornerShape(6.dp)).background(if (portal.includeRemarks) PortalColors.Halo else PortalColors.White),
                    contentAlignment = Alignment.Center,
                ) {
                    if (portal.includeRemarks) Text("✓", color = PortalColors.Blue, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.size(10.dp))
                Text("Include remarks on the PDF", color = PortalColors.Ink, fontSize = 13.sp)
            }
            Spacer(Modifier.height(14.dp))
            BlueButton(if (portal.busy) "Opening…" else "Open PDF", enabled = !portal.busy, onClick = portal::openPdf)
            if (slip.days.isNotEmpty()) {
                Spacer(Modifier.height(22.dp))
                Text("Days", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(12.dp))
                Column(Modifier.card(8.dp)) {
                    slip.days.forEach { day ->
                        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(day.workDate, color = PortalColors.Ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                Text("${day.timeInLabel} – ${day.timeOutLabel}", color = PortalColors.Muted, fontSize = 12.sp)
                            }
                            Text(formatMoney(day.dayPay), color = PortalColors.Ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
internal fun ProfileScreen(portal: PortalController) {
    var password by remember { mutableStateOf("") }
    var reveal by remember { mutableStateOf(false) }
    val user = portal.user
    val name = user?.fullName?.ifBlank { user.username } ?: "Profile"
    val picker = rememberProfileImagePicker()
    Screen {
        Spacer(Modifier.height(8.dp))
        Title("Profile", "Your details and account preferences.")
        Spacer(Modifier.height(18.dp))
        Messages(portal)
        Column(Modifier.card(), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.size(96.dp).clip(CircleShape).background(PortalColors.Halo).clickable {
                picker.pick { result ->
                    result.onSuccess { portal.uploadProfileImage(it) }
                    result.onFailure { portal.error = it.message }
                }
            }, contentAlignment = Alignment.Center) {
                val photo = portal.avatar
                if (photo != null) {
                    Image(photo, contentDescription = "Profile photo", modifier = Modifier.fillMaxSize().clip(CircleShape), contentScale = ContentScale.Crop)
                } else {
                    Text(name.take(1).uppercase(), color = PortalColors.Blue, fontSize = 32.sp, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(12.dp))
            Text(name, color = PortalColors.Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Text(user?.role?.ifBlank { "Employee" } ?: "Employee", color = PortalColors.Muted, fontSize = 14.sp)
            Spacer(Modifier.height(4.dp))
            Text(
                if (user?.payrollEnabled == true) "Payroll time clock is on" else "Payroll time clock is off",
                color = if (user?.payrollEnabled == true) PortalColors.Green else PortalColors.Muted,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(14.dp))
            Text(
                if (portal.busy) "Saving photo…" else "Upload photo",
                color = PortalColors.Blue,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable(enabled = !portal.busy) {
                    picker.pick { result ->
                        result.onSuccess { portal.uploadProfileImage(it) }
                        result.onFailure { portal.error = it.message }
                    }
                },
            )
            if (!user?.profileImageUrl.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(
                    "Remove photo",
                    color = PortalColors.Danger,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.clickable(enabled = !portal.busy, onClick = portal::removeProfileImage),
                )
            }
        }
        Spacer(Modifier.height(22.dp))
        Text("Organization", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Row(Modifier.card(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)).background(PortalColors.Halo), contentAlignment = Alignment.Center) {
                Text("PC", color = PortalColors.Blue, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.size(14.dp))
            Column {
                Text("PCmazing", color = PortalColors.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Text("We Build It Better!", color = PortalColors.Muted, fontSize = 13.sp)
            }
        }
        Spacer(Modifier.height(22.dp))
        Text("Account", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Column(Modifier.card(0.dp)) {
            DetailLine("Username", user?.username.orEmpty().ifBlank { "—" })
            DetailLine("Work email", user?.email ?: "—")
            DetailLine("Role", user?.role?.ifBlank { "Employee" } ?: "Employee", last = true)
        }
        Spacer(Modifier.height(22.dp))
        Text("Security & password", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Column(Modifier.card(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconBadge(Res.drawable.portal_shield, PortalColors.Halo)
                Spacer(Modifier.size(10.dp))
                Text("At least 6 characters", color = PortalColors.Muted, fontSize = 13.sp)
            }
            Field(
                "New password",
                password,
                { password = it },
                "Enter a new password",
                visual = if (reveal) VisualTransformation.None else PasswordVisualTransformation(),
                keyboard = KeyboardOptions(keyboardType = KeyboardType.Password),
                trailing = if (reveal) "HIDE" else "SHOW",
                onTrailing = { reveal = !reveal },
            )
            BlueButton(if (portal.busy) "Updating…" else "Update password", enabled = !portal.busy) {
                portal.changePassword(password)
                password = ""
            }
        }
        Spacer(Modifier.height(22.dp))
        Row(
            Modifier.fillMaxWidth().clickable(onClick = portal::logout).padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PortalIcon(Res.drawable.portal_logout, 16.dp, PortalColors.Blue)
            Spacer(Modifier.size(8.dp))
            Text("Sign out", color = PortalColors.Blue, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
internal fun NotificationsScreen(portal: PortalController) {
    val notices = portalNotices(portal)
    val unread = notices.filter { it.id !in portal.readNotices }
    val today = notices.filter { it.today }
    val earlier = notices.filter { !it.today }
    var marked by remember { mutableStateOf(false) }
    Screen {
        Spacer(Modifier.height(8.dp))
        BackLink(portal::back)
        Spacer(Modifier.height(16.dp))
        Text("Notifications", color = PortalColors.Ink, fontSize = 28.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.9).sp)
        Spacer(Modifier.height(6.dp))
        Text("Updates that need your attention.", color = PortalColors.Muted, fontSize = 14.sp)
        if (unread.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            Text(
                "Mark all as read",
                color = PortalColors.Blue,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable {
                    portal.markNoticesRead(notices.map { it.id })
                    marked = true
                },
            )
        }
        if (marked) {
            Spacer(Modifier.height(14.dp))
            Text("Notifications marked as read.", color = PortalColors.Green, fontSize = 13.sp)
        }
        Spacer(Modifier.height(18.dp))
        if (notices.isEmpty()) {
            Text("No new updates.", color = PortalColors.Muted, fontSize = 14.sp)
        } else {
            NoticeGroup("Today", today, portal)
            NoticeGroup("Earlier", earlier, portal)
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun NoticeGroup(title: String, items: List<PortalNotice>, portal: PortalController) {
    if (items.isEmpty()) return
    Text(title, color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(12.dp))
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items.forEach { notice ->
            val unread = notice.id !in portal.readNotices
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).border(1.dp, PortalColors.Line, RoundedCornerShape(16.dp)).background(PortalColors.White).clickable {
                    portal.markNoticeRead(notice.id)
                    notice.open(portal)
                }.padding(16.dp),
                verticalAlignment = Alignment.Top,
            ) {
                IconBadge(notice.icon, PortalColors.Halo)
                Spacer(Modifier.size(12.dp))
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(notice.title, color = PortalColors.Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        if (notice.whenLabel.isNotBlank()) Text(notice.whenLabel, color = PortalColors.Muted, fontSize = 11.sp)
                        if (unread) {
                            Spacer(Modifier.size(8.dp))
                            Box(Modifier.size(8.dp).clip(CircleShape).background(Color(0xFFEF4444)))
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(notice.message, color = PortalColors.Muted, fontSize = 12.sp, lineHeight = 18.sp)
                }
            }
        }
    }
    Spacer(Modifier.height(18.dp))
}

internal data class PortalNotice(
    val id: String,
    val title: String,
    val message: String,
    val whenLabel: String,
    val today: Boolean,
    val icon: org.jetbrains.compose.resources.DrawableResource,
    val open: (PortalController) -> Unit,
)

internal fun portalNotices(portal: PortalController): List<PortalNotice> {
    val todayKey = portal.dashboard?.workDate?.take(10).orEmpty()
    val items = mutableListOf<PortalNotice>()
    portal.memos.forEach { memo ->
        val date = memo.issuedAt?.take(10).orEmpty()
        items += PortalNotice(
            id = "memo-${memo.id}",
            title = memo.subject.ifBlank { "Company memo" },
            message = "${memo.memoNo} · ${memo.memoTypeLabel}".trim(' ', '·'),
            whenLabel = if (date.isNotBlank() && date == todayKey) "Today" else date,
            today = date.isNotBlank() && date == todayKey,
            icon = Res.drawable.portal_shield,
        ) { it.openMemo(memo.id) }
    }
    portal.dashboard?.payslips?.take(3)?.forEach { slip ->
        val date = slip.dateTo.take(10)
        items += PortalNotice(
            id = "slip-${slip.id}",
            title = "Payslip ready",
            message = "${slip.label.ifBlank { "${slip.dateFrom} – ${slip.dateTo}" }} · ${com.pcmazing.portal.formatMoney(slip.estimatedPay)}",
            whenLabel = if (date == todayKey) "Today" else date,
            today = date == todayKey && date.isNotBlank(),
            icon = Res.drawable.portal_payslip,
        ) { it.openPayslip(slip.id) }
    }
    portal.dashboard?.attendanceDays?.forEach { day ->
        val date = day.workDate.take(10)
        val missing = date != todayKey && !day.timeIn.isNullOrBlank() && day.timeOut.isNullOrBlank()
        val openShift = date == todayKey && !day.timeIn.isNullOrBlank() && day.timeOut.isNullOrBlank()
        if (openShift) {
            items += PortalNotice(
                id = "clock-$date",
                title = "Clocked in",
                message = "You clocked in at ${com.pcmazing.portal.formatManila(day.timeIn)}. Remember to clock out.",
                whenLabel = "Today",
                today = true,
                icon = Res.drawable.portal_clock,
            ) { it.open(Route.Clock) }
        } else if (missing && day.id != null) {
            items += PortalNotice(
                id = "missing-${day.id}",
                title = "Missing punch",
                message = "Your attendance for $date is missing a time out.",
                whenLabel = date,
                today = false,
                icon = Res.drawable.portal_clock,
            ) { it.open(Route.Adjust(day.id, date)) }
        }
    }
    portal.dashboard?.overtimeNotice?.message?.takeIf { it.isNotBlank() }?.let { message ->
        items += PortalNotice("ot", "Overtime", message, "Today", true, Res.drawable.portal_timesheet) { it.open(Route.Timesheet) }
    }
    portal.dashboard?.adjustmentNotice?.message?.takeIf { it.isNotBlank() }?.let { message ->
        items += PortalNotice("adjust", "Time-out request", message, "Today", true, Res.drawable.portal_clock) { it.tab(Route.Attendance) }
    }
    portal.timesheet?.timesheet?.let { sheet ->
        val label = when (sheet.status) {
            "submitted" -> "Your timesheet is with the COO and CEO."
            "reverted" -> sheet.reviewNote ?: "Your timesheet was sent back for recheck."
            "approved" -> "Your timesheet is approved and waiting for the founder."
            "finalized" -> "Your payslip posts on ${sheet.postedOn ?: "the chosen date"}."
            else -> null
        }
        if (label != null) {
            items += PortalNotice("timesheet-${sheet.id}", "Timesheet", label, "Today", true, Res.drawable.portal_timesheet) { it.open(Route.Timesheet) }
        }
    }
    return items
}

@Composable
internal fun MemoListScreen(portal: PortalController) {
    val pending = portal.memos.filter { it.acknowledgedAt.isNullOrBlank() }
    val done = portal.memos.filter { !it.acknowledgedAt.isNullOrBlank() }
    Screen {
        Spacer(Modifier.height(8.dp))
        BackLink(portal::back)
        Spacer(Modifier.height(16.dp))
        Title("Memos", "Company notices that need your acknowledgement.")
        Spacer(Modifier.height(16.dp))
        Messages(portal)
        if (portal.memos.isEmpty()) {
            Text("No memos.", color = PortalColors.Muted, fontSize = 13.sp)
        }
        if (pending.isNotEmpty()) {
            Text("Needs acknowledgement", color = PortalColors.Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))
            MemoGroup(pending.map { it.subject to "${it.memoNo} · Pending" to it.id }) { portal.openMemo(it) }
            Spacer(Modifier.height(18.dp))
        }
        if (done.isNotEmpty()) {
            Text("Acknowledged", color = PortalColors.Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))
            MemoGroup(done.map { it.subject to "${it.memoNo} · Acknowledged" to it.id }) { portal.openMemo(it) }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
internal fun MemoOverlay(
    memo: MemoDetail,
    busy: Boolean,
    error: String?,
    acknowledgeLabel: String = "Acknowledge",
    onAcknowledge: () -> Unit,
) {
    Column(
        Modifier.fillMaxSize().background(Color(0xF0F8FAFC)).verticalScroll(rememberScrollState()).padding(24.dp),
    ) {
        Text(memo.memoTypeLabel.ifBlank { "Memo" }, color = PortalColors.Blue, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Text(memo.subject, color = PortalColors.Ink, fontSize = 26.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.6).sp)
        Text(memo.memoNo, color = PortalColors.Muted, fontSize = 13.sp)
        Spacer(Modifier.height(16.dp))
        Column(Modifier.card(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(memo.statementOfFacts, color = PortalColors.Ink, fontSize = 14.sp, lineHeight = 20.sp)
            if (!memo.policyViolated.isNullOrBlank()) Text("Policy: ${memo.policyViolated}", color = PortalColors.Muted, fontSize = 13.sp)
            if (!memo.directive.isNullOrBlank()) Text("Directive: ${memo.directive}", color = PortalColors.Ink, fontSize = 13.sp)
            if (!error.isNullOrBlank()) Text(error, color = PortalColors.Danger, fontSize = 13.sp)
        }
        Spacer(Modifier.height(16.dp))
        BlueButton(if (busy) "Saving…" else acknowledgeLabel, enabled = !busy, onClick = onAcknowledge)
    }
}

@Composable
internal fun ClockScreen(portal: PortalController) {
    val actions = rememberTimeClockActions()
    val status = portal.clock
    var location by remember { mutableStateOf("office") }
    var selfie by remember { mutableStateOf<StampedSelfie?>(null) }
    var intent by remember { mutableStateOf("end_of_day") }
    Screen {
        Spacer(Modifier.height(8.dp))
        BackLink(portal::back)
        Spacer(Modifier.height(16.dp))
        Text("Time clock", color = PortalColors.Ink, fontSize = 32.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        Text("A selfie is saved with every punch.", color = PortalColors.Muted, fontSize = 15.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(14.dp))
        Text(formatManila(status?.serverNow, withDate = true), color = PortalColors.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        Text("SERVER TIME", color = PortalColors.Muted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.6.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(18.dp))
        Messages(portal)
        if (portal.loading && status == null) CircularProgressIndicator(color = PortalColors.Blue)
        status?.let { current ->
            Column(Modifier.card(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(current.fullName.ifBlank { current.username }, color = PortalColors.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Text(current.message.ifBlank { current.status }, color = PortalColors.Muted, fontSize = 13.sp)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PunchBox("TIME IN", formatManila(current.timeIn), current.timeIn != null, Modifier.weight(1f))
                    PunchBox("TIME OUT", formatManila(current.timeOut), current.timeOut != null, Modifier.weight(1f))
                }
                if (current.onLunch || current.lunchOut != null || current.canLunchIn) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        PunchBox("LUNCH OUT", formatManila(current.lunchOut), current.lunchOut != null, Modifier.weight(1f))
                        PunchBox("LUNCH IN", formatManila(current.lunchIn), current.lunchIn != null, Modifier.weight(1f))
                    }
                }
            }
            Spacer(Modifier.height(14.dp))
            val blocked = current.status == "not_enrolled" || current.status == "inactive" || current.status == "not_found"
            if (blocked || (!current.canTimeIn && !current.canTimeOut && !current.canLunchIn)) {
                Text(current.message.ifBlank { "Time clock is not available for this account." }, color = PortalColors.Muted, fontSize = 13.sp)
            } else {
                if (current.canTimeIn && !current.canLunchIn) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Choice("Office", location == "office") { location = "office" }
                        Choice("Work from home", location == "wfh") { location = "wfh" }
                    }
                    Spacer(Modifier.height(10.dp))
                }
                if (current.canTimeOut && current.punchOutRequiresIntent) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Choice("Lunch out", intent == "lunch") { intent = "lunch" }
                        Choice("End of day", intent == "end_of_day") { intent = "end_of_day" }
                    }
                    Spacer(Modifier.height(10.dp))
                }
                Column(Modifier.card(), horizontalAlignment = Alignment.CenterHorizontally) {
                    val shot = selfie
                    if (shot == null) {
                        Text("Take a selfie before you punch.", color = PortalColors.Muted, fontSize = 13.sp, textAlign = TextAlign.Center)
                    } else {
                        Image(shot.image, contentDescription = "Selfie", modifier = Modifier.fillMaxWidth().height(220.dp).clip(RoundedCornerShape(16.dp)), contentScale = ContentScale.Crop)
                        Spacer(Modifier.height(8.dp))
                        Text(if (shot.hasFix) shot.placeName else "Location not fixed", color = PortalColors.Muted, fontSize = 12.sp, textAlign = TextAlign.Center)
                    }
                    Spacer(Modifier.height(12.dp))
                    OutlineAction(if (selfie == null) "Take selfie" else "Retake selfie") {
                        actions.captureSelfie(
                            ServerTimeFetch { callback ->
                                val iso = portal.clock?.serverNow.orEmpty()
                                callback(Result.success(ServerClock(iso = iso, date = formatManila(iso, withDate = true), time = formatManila(iso))))
                            },
                        ) { result ->
                            result.onSuccess { selfie = it }
                            result.onFailure { portal.error = it.message }
                        }
                    }
                }
                Spacer(Modifier.height(14.dp))
                val shot = selfie
                BlueButton(
                    when {
                        portal.busy -> "Saving…"
                        current.canLunchIn -> "Lunch in"
                        current.canTimeIn -> "Time in"
                        intent == "lunch" && current.punchOutRequiresIntent -> "Lunch out"
                        else -> "Time out"
                    },
                    enabled = shot != null && !portal.busy,
                ) {
                    if (shot != null) {
                        when {
                            current.canLunchIn -> portal.punchIn("office", shot)
                            current.canTimeIn -> portal.punchIn(location, shot)
                            current.canTimeOut -> portal.punchOut(if (current.punchOutRequiresIntent) intent else "end_of_day", shot)
                        }
                        selfie = null
                    }
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Text("Refresh status", color = PortalColors.Blue, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable(onClick = portal::refresh).align(Alignment.CenterHorizontally))
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
internal fun AdjustmentScreen(portal: PortalController, attendanceId: Int, workDate: String) {
    val actions = rememberTimeClockActions()
    var time by remember(workDate) { mutableStateOf("${workDate}T18:00") }
    var note by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("emergency") }
    var selfie by remember { mutableStateOf<StampedSelfie?>(null) }
    Screen {
        Spacer(Modifier.height(8.dp))
        BackLink(portal::back)
        Spacer(Modifier.height(16.dp))
        Title("Missed time-out", workDate)
        Spacer(Modifier.height(8.dp))
        Text("Admin must approve this before payroll uses it.", color = PortalColors.Muted, fontSize = 13.sp)
        Spacer(Modifier.height(16.dp))
        Messages(portal)
        Column(Modifier.card(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Field("Time you left", time, { time = it }, "YYYY-MM-DDTHH:mm")
            Field("Why you missed clocking out", note, { note = it }, "Explain the missed punch")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("emergency", "appointment", "event", "other").forEach { item ->
                    Choice(item.replaceFirstChar { it.uppercase() }, category == item) { category = item }
                }
            }
            selfie?.let {
                Image(it.image, contentDescription = "Time-out photo", modifier = Modifier.fillMaxWidth().height(180.dp).clip(RoundedCornerShape(16.dp)), contentScale = ContentScale.Crop)
            }
            OutlineAction("Take time-out photo") {
                actions.captureSelfie(ServerTimeFetch { callback ->
                    callback(Result.success(ServerClock("", workDate, time)))
                }) { result ->
                    result.onSuccess { selfie = it }
                    result.onFailure { portal.error = it.message }
                }
            }
            val shot = selfie
            BlueButton("Submit request", enabled = shot != null && !portal.busy) {
                if (shot != null) portal.submitAdjustment(attendanceId, time, note, category, shot)
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
internal fun TimesheetScreen(portal: PortalController) {
    val data = portal.dashboard
    val mine = portal.timesheet
    val sheet = mine?.timesheet
    val status = sheet?.status.orEmpty()
    val name = portal.user?.fullName?.ifBlank { portal.user?.username } ?: "there"
    val first = name.substringBefore(' ')
    val todayKey = data?.workDate?.take(10).orEmpty()
    val rows = data?.attendanceDays.orEmpty()
        .filter { !it.timeIn.isNullOrBlank() || (it.hoursWorked ?: 0.0) > 0.0 }
        .sortedByDescending { it.workDate }
    val worked = data?.monthSummary?.totalHours ?: mine?.attendance?.totalHours ?: 0.0
    val overtime = rows.sumOf { it.overtimeHours ?: 0.0 }
    val regular = (worked - overtime).coerceAtLeast(0.0)
    val target = 80.0
    val ratio = (worked / target).coerceIn(0.0, 1.0)
    val remaining = (target - worked).coerceAtLeast(0.0)
    val openToday = rows.any { it.workDate.take(10) == todayKey && it.timeOut.isNullOrBlank() && !it.timeIn.isNullOrBlank() }
    val place = portal.clock?.expectedLocation?.substringBefore(',')?.trim()?.takeIf { it.isNotEmpty() }
    val dayOffs = data?.dayOffs.orEmpty()
    val overtimeRows = rows.filter { (it.overtimeHours ?: 0.0) > 0.0 }
    val adjustments = rows.filter { !it.adjustmentStatus.isNullOrBlank() }
    val locked = status == "submitted" || status == "approved" || status == "finalized"
    val stage = timesheetStage(status)
    var note by remember(portal.month, sheet?.employeeNote) { mutableStateOf(sheet?.employeeNote.orEmpty()) }
    var postedOn by remember { mutableStateOf("") }
    LaunchedEffect(portal.month) { portal.loadTimesheet() }
    Screen {
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
                Text(name, color = PortalColors.Ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
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
        Spacer(Modifier.height(18.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(32.dp).clickable(onClick = portal::back), contentAlignment = Alignment.CenterStart) {
                Image(
                    painterResource(Res.drawable.portal_chevron),
                    contentDescription = "Back",
                    modifier = Modifier.size(20.dp).graphicsLayer { rotationZ = 180f },
                    colorFilter = ColorFilter.tint(PortalColors.Ink),
                )
            }
            Text("Timesheet", color = PortalColors.Ink, fontSize = 28.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.9).sp)
        }
        Spacer(Modifier.height(6.dp))
        Text("Review your hours before sending for approval.", color = PortalColors.Muted, fontSize = 14.sp)
        Spacer(Modifier.height(14.dp))
        Messages(portal)
        if (portal.loading && data == null && mine == null) {
            CircularProgressIndicator(color = PortalColors.Blue)
            Spacer(Modifier.height(14.dp))
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            PortalIcon(Res.drawable.portal_calendar, 15.dp)
            Spacer(Modifier.size(7.dp))
            Text(monthTitle(portal.month), color = PortalColors.Muted, fontSize = 12.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Badge("CURRENT CUT-OFF")
        }
        Spacer(Modifier.height(14.dp))
        Column(Modifier.card(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconBadge(Res.drawable.portal_clock, PortalColors.Halo)
                Spacer(Modifier.size(10.dp))
                Text("Estimated Working Hours", color = PortalColors.Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Row(
                    Modifier.clip(RoundedCornerShape(100.dp)).background(if (ratio >= 0.9) PortalColors.GreenWash else PortalColors.AmberWash).padding(horizontal = 8.dp, vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (ratio >= 0.9) {
                        PortalIcon(Res.drawable.portal_check, 12.dp, PortalColors.Green)
                        Spacer(Modifier.size(4.dp))
                    }
                    Text(if (ratio >= 0.9) "On track" else "In progress", color = if (ratio >= 0.9) PortalColors.Green else PortalColors.Amber, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
            }
            Row(verticalAlignment = Alignment.Bottom) {
                Text(hourFigure(worked), color = PortalColors.Ink, fontSize = 34.sp, fontWeight = FontWeight.Bold, letterSpacing = (-1).sp)
                Text(" / ${target.toInt()} hrs", color = PortalColors.Muted, fontSize = 16.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(bottom = 4.dp))
            }
            Box(Modifier.fillMaxWidth().height(7.dp).clip(RoundedCornerShape(100.dp)).background(PortalColors.Track)) {
                Box(Modifier.fillMaxWidth(ratio.toFloat()).height(7.dp).clip(RoundedCornerShape(100.dp)).background(PortalColors.Blue))
            }
            Row(Modifier.fillMaxWidth()) {
                Text("${hourFigure(remaining)} hrs to your period target", color = PortalColors.Muted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                Text("${(ratio * 100).toInt()}%", color = PortalColors.Blue, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        Spacer(Modifier.height(16.dp))
        Row(Modifier.fillMaxWidth()) {
            HourStat(if (regular == 0.0) "0 hrs" else "${hourFigure(regular)} hrs", "Regular hours", Modifier.weight(1f))
            HourStat(if (overtime == 0.0) "0 hrs" else "${hourFigure(overtime)} hrs", "Overtime", Modifier.weight(1f))
            HourStat(if (dayOffs.size == 1) "1 day" else "${dayOffs.size} days", "Day offs", Modifier.weight(1f))
        }
        Spacer(Modifier.height(22.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Daily entries", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Text(if (rows.size == 1) "1 workday" else "${rows.size} workdays", color = PortalColors.Muted, fontSize = 13.sp)
        }
        Spacer(Modifier.height(12.dp))
        Column(Modifier.card(0.dp)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(monthTitle(portal.month), color = PortalColors.Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Text(stage, color = if (status == "submitted" || status == "reverted") PortalColors.Amber else PortalColors.Muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
            if (rows.isEmpty()) {
                Box(Modifier.fillMaxWidth().height(1.dp).background(PortalColors.Line))
                Text("No hours recorded this month.", color = PortalColors.Muted, fontSize = 13.sp, modifier = Modifier.padding(16.dp))
            }
            rows.forEach { row ->
                Box(Modifier.fillMaxWidth().height(1.dp).background(PortalColors.Line))
                TimesheetEntry(row, todayKey, place)
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(PortalColors.Line))
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Total recorded hours", color = PortalColors.Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Text("${hourFigure(worked)} hrs", color = PortalColors.Ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            }
        }
        Spacer(Modifier.height(22.dp))
        Text("Summary before submit", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Text("Day offs, overtime, and time-out requests in this month go with the timesheet.", color = PortalColors.Muted, fontSize = 13.sp)
        Spacer(Modifier.height(12.dp))
        Column(Modifier.card(0.dp)) {
            SummaryBlock("Day offs", if (dayOffs.isEmpty()) listOf("None this month") else dayOffs.map { off ->
                listOf(off.dayOffDate.take(10), off.reason?.takeIf { it.isNotBlank() }).filterNotNull().joinToString(" · ")
            })
            Box(Modifier.fillMaxWidth().height(1.dp).background(PortalColors.Line))
            SummaryBlock("Overtime", if (overtimeRows.isEmpty()) listOf("None this month") else overtimeRows.map { row ->
                "${row.workDate.take(10)} · ${hourFigure(row.overtimeHours ?: 0.0)} hrs · ${row.overtimeStatus?.ifBlank { "recorded" } ?: "recorded"}"
            })
            Box(Modifier.fillMaxWidth().height(1.dp).background(PortalColors.Line))
            SummaryBlock("Time-out requests", if (adjustments.isEmpty()) listOf("None this month") else adjustments.map { row ->
                "${row.workDate.take(10)} · ${row.adjustmentStatus.orEmpty()}"
            })
        }
        Spacer(Modifier.height(14.dp))
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(PortalColors.Halo).padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(22.dp).clip(CircleShape).background(PortalColors.Blue), contentAlignment = Alignment.Center) {
                Text("i", color = PortalColors.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.size(10.dp))
            Text(
                if (openToday) {
                    "Today's hours are in progress and will update after you clock out."
                } else {
                    "Recorded hours come from your time in and time out for this month."
                },
                color = PortalColors.Ink,
                fontSize = 12.sp,
                lineHeight = 17.sp,
            )
        }
        if (!sheet?.reviewNote.isNullOrBlank()) {
            Spacer(Modifier.height(14.dp))
            Text(sheet?.reviewNote.orEmpty(), color = PortalColors.Danger, fontSize = 13.sp)
        }
        if (status == "finalized") {
            Spacer(Modifier.height(8.dp))
            Text("Payslip appears on ${sheet?.postedOn ?: "the posted date"}.", color = PortalColors.Green, fontSize = 13.sp)
        }
        if (!locked) {
            Spacer(Modifier.height(16.dp))
            Field("Note for the reviewer", note, { note = it }, "Optional")
        }
        Spacer(Modifier.height(16.dp))
        Box(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(if (locked || portal.busy) PortalColors.Muted else PortalColors.Blue).clickable(enabled = !locked && !portal.busy) {
                portal.submitTimesheet(note)
            }.padding(vertical = 14.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                when {
                    portal.busy -> "Sending…"
                    status == "finalized" -> "Payslip posted"
                    status == "approved" -> "Waiting for the founder"
                    status == "submitted" -> "Waiting for COO / CEO"
                    status == "reverted" -> "Send for approval again"
                    else -> "Send for approval"
                },
                color = PortalColors.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
        Spacer(Modifier.height(10.dp))
        Text(
            when (status) {
                "submitted" -> "The COO and CEO review these hours before the founder posts the payslip."
                "approved" -> "Approved. The founder chooses the date the payslip appears."
                "reverted" -> sheet?.reviewNote ?: "This was sent back. Correct the hours, then send it again."
                "finalized" -> "This month is posted. The payslip appears on the chosen date."
                else -> "Send for approval includes the hours above, day offs, overtime, and time-out requests."
            },
            color = PortalColors.Muted,
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        if (mine?.canReview == true) {
            Spacer(Modifier.height(22.dp))
            Text("COO / CEO review", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(12.dp))
            if (portal.reviewQueue.isEmpty()) {
                Text("No timesheets waiting.", color = PortalColors.Muted, fontSize = 13.sp)
            }
            portal.reviewQueue.forEach { item ->
                ReviewCard(item, portal.busy, onApprove = { portal.approveTimesheet(item.id, it) }, onRevert = { portal.revertTimesheet(item.id, it) })
                Spacer(Modifier.height(10.dp))
            }
        }
        if (mine?.canFinalize == true) {
            Spacer(Modifier.height(22.dp))
            Text("Founder payslip posting", color = PortalColors.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Text("Approved timesheets stay hidden until this date.", color = PortalColors.Muted, fontSize = 13.sp)
            Spacer(Modifier.height(12.dp))
            if (portal.finalizeQueue.isEmpty()) {
                Text("Nothing is waiting to be posted.", color = PortalColors.Muted, fontSize = 13.sp)
            }
            portal.finalizeQueue.forEach { item ->
                Column(Modifier.card(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(item.fullName.ifBlank { item.username }, color = PortalColors.Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    Text("${item.periodFrom} – ${item.periodTo} · ${formatHours(item.totalHours)}", color = PortalColors.Muted, fontSize = 12.sp)
                    Field("Payslip post date", postedOn, { postedOn = it }, "YYYY-MM-DD")
                    BlueButton("Post payslip", enabled = !portal.busy) { portal.finalizeTimesheet(item.id, postedOn) }
                }
                Spacer(Modifier.height(10.dp))
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun ReviewCard(
    item: com.pcmazing.portal.data.TimesheetRecord,
    busy: Boolean,
    onApprove: (String) -> Unit,
    onRevert: (String) -> Unit,
) {
    var reviewNote by remember(item.id) { mutableStateOf("") }
    Column(Modifier.card(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(item.fullName.ifBlank { item.username }, color = PortalColors.Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        Text("${item.periodFrom} – ${item.periodTo}", color = PortalColors.Muted, fontSize = 12.sp)
        Text("${item.daysPresent} present · ${formatHours(item.totalHours)}", color = PortalColors.Ink, fontSize = 13.sp)
        if (!item.employeeNote.isNullOrBlank()) Text(item.employeeNote, color = PortalColors.Muted, fontSize = 13.sp)
        Field("Note", reviewNote, { reviewNote = it }, "Required when sending back")
        BlueButton("Approve", enabled = !busy) { onApprove(reviewNote) }
        Text(
            "Revert for recheck",
            color = PortalColors.Danger,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.clickable(enabled = !busy) { onRevert(reviewNote) },
        )
    }
}

private fun timesheetStage(status: String): String = when (status) {
    "submitted" -> "Waiting for COO / CEO"
    "reverted" -> "Sent back"
    "approved" -> "Approved"
    "finalized" -> "Posted"
    else -> "Draft"
}

@Composable
private fun HourStat(value: String, label: String, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, color = PortalColors.Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        Text(label, color = PortalColors.Muted, fontSize = 12.sp, textAlign = TextAlign.Center)
    }
}

@Composable
private fun TimesheetEntry(row: AttendanceDay, todayKey: String, place: String?) {
    val open = row.workDate.take(10) == todayKey && row.timeOut.isNullOrBlank() && !row.timeIn.isNullOrBlank()
    val title = when {
        open -> listOf(formatManila(row.timeIn), "In progress").joinToString(" · ")
        !row.timeIn.isNullOrBlank() && !row.timeOut.isNullOrBlank() -> "${formatManila(row.timeIn)} – ${formatManila(row.timeOut)}"
        !row.timeIn.isNullOrBlank() -> formatManila(row.timeIn)
        else -> "Recorded"
    }
    val detail = when {
        open && place != null -> "Active shift · $place"
        open -> "Active shift"
        else -> place
    }
    val day = row.workDate.take(10).takeLast(2).trimStart('0')
    Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.width(42.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(dayName(row.workDate), color = PortalColors.Muted, fontSize = 11.sp)
            Text(day, color = if (open) PortalColors.Blue else PortalColors.Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.size(10.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = PortalColors.Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (detail != null) Text(detail, color = PortalColors.Muted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(hourFigure(row.hoursWorked ?: 0.0), color = if (open) PortalColors.Blue else PortalColors.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            Text("hrs", color = PortalColors.Muted, fontSize = 11.sp)
        }
    }
}

@Composable
private fun SummaryBlock(title: String, lines: List<String>) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
        Text(title, color = PortalColors.Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(6.dp))
        lines.forEach { line ->
            Text(line, color = PortalColors.Muted, fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(4.dp))
        }
    }
}

private fun hourFigure(value: Double): String {
    val rounded = round(value * 100.0) / 100.0
    val text = rounded.toString()
    return if (text.contains('.')) text.trimEnd('0').trimEnd('.') else text
}

private fun dayName(date: String): String {
    val parts = date.take(10).split('-')
    val year = parts.getOrNull(0)?.toIntOrNull() ?: return ""
    val month = parts.getOrNull(1)?.toIntOrNull() ?: return ""
    val day = parts.getOrNull(2)?.toIntOrNull() ?: return ""
    return listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat").getOrElse(weekdaySunday0(year, month, day)) { "" }
}

@Composable
private fun Screen(content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp),
        content = content,
    )
}

@Composable
private fun Title(title: String, subtitle: String) {
    Text(title, color = PortalColors.Ink, fontSize = 28.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.9).sp)
    if (subtitle.isNotBlank()) {
        Spacer(Modifier.height(6.dp))
        Text(subtitle, color = PortalColors.Muted, fontSize = 14.sp)
    }
}

@Composable
private fun BackLink(onBack: () -> Unit) {
    Text("←  Back", color = PortalColors.Blue, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable(onClick = onBack))
}

@Composable
private fun Messages(portal: PortalController) {
    if (!portal.error.isNullOrBlank()) {
        Text(portal.error.orEmpty(), color = PortalColors.Danger, fontSize = 13.sp)
        Spacer(Modifier.height(8.dp))
    }
    if (!portal.notice.isNullOrBlank()) {
        Text(portal.notice.orEmpty(), color = PortalColors.Green, fontSize = 13.sp)
        Spacer(Modifier.height(8.dp))
    }
}

private fun Modifier.card(padding: androidx.compose.ui.unit.Dp = 16.dp): Modifier = this
    .fillMaxWidth()
    .clip(RoundedCornerShape(20.dp))
    .border(1.dp, PortalColors.Line, RoundedCornerShape(20.dp))
    .background(PortalColors.White)
    .padding(padding)

@Composable
private fun Badge(text: String) {
    Text(
        text,
        color = PortalColors.Blue,
        fontSize = 10.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.clip(RoundedCornerShape(100.dp)).background(PortalColors.Halo).padding(horizontal = 8.dp, vertical = 4.dp),
    )
}

@Composable
private fun Stat(value: String, label: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, color = color, fontSize = 28.sp, fontWeight = FontWeight.Bold)
        Text(label, color = PortalColors.Muted, fontSize = 12.sp, textAlign = TextAlign.Center)
    }
}

@Composable
private fun ProofRow(title: String, value: String, detail: String, place: String, done: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        SelfieMark(done)
        Spacer(Modifier.size(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = if (done) PortalColors.Green else PortalColors.Blue, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.6.sp)
            Text(value, color = PortalColors.Ink, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Text(detail, color = PortalColors.Muted, fontSize = 12.sp)
            Text(place, color = PortalColors.Ink, fontSize = 12.sp)
        }
    }
}

@Composable
private fun SelfieMark(done: Boolean) {
    Box(Modifier.size(64.dp, 78.dp), contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .matchParentSize()
                .clip(RoundedCornerShape(14.dp))
                .background(if (done) PortalColors.Halo else PortalColors.Page)
                .then(
                    if (done) {
                        Modifier
                    } else {
                        Modifier.drawBehind {
                            drawRoundRect(
                                color = Color(0xFF93C5FD),
                                style = Stroke(width = 1.5.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f))),
                                cornerRadius = androidx.compose.ui.geometry.CornerRadius(14.dp.toPx()),
                            )
                        }
                    },
                ),
        )
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.size(22.dp).clip(CircleShape).background(if (done) PortalColors.Blue else Color(0xFF93C5FD)))
            Spacer(Modifier.height(4.dp))
            Box(
                Modifier.size(width = 34.dp, height = 18.dp).clip(RoundedCornerShape(topStart = 17.dp, topEnd = 17.dp)).background(if (done) Color(0xFF60A5FA) else Color(0xFFBFDBFE)),
            )
        }
    }
}

@Composable
private fun DailyRecord(row: AttendanceDay, todayKey: String, onClick: () -> Unit) {
    val open = row.workDate.take(10) == todayKey && row.timeOut.isNullOrBlank() && !row.timeIn.isNullOrBlank()
    val badge = when {
        open -> "Clocked in"
        row.timeOut.isNullOrBlank() && row.timeIn.isNullOrBlank() -> "Incomplete"
        row.timeOut.isNullOrBlank() -> "Incomplete"
        else -> "Present"
    }
    val detail = when {
        !row.timeIn.isNullOrBlank() && !row.timeOut.isNullOrBlank() -> "${formatManila(row.timeIn)} – ${formatManila(row.timeOut)}"
        !row.timeIn.isNullOrBlank() -> formatManila(row.timeIn)
        else -> "No punch"
    }
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(row.workDate.take(10), color = PortalColors.Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(detail, color = PortalColors.Muted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                badge,
                color = if (badge == "Incomplete") PortalColors.Danger else PortalColors.Green,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clip(RoundedCornerShape(100.dp))
                    .background(if (open) PortalColors.GreenWash else Color.Transparent)
                    .padding(horizontal = if (open) 8.dp else 0.dp, vertical = if (open) 4.dp else 0.dp),
            )
            Text(formatHours(row.hoursWorked), color = PortalColors.Ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun MonthCalendar(portal: PortalController) {
    val data = portal.dashboard
    val month = portal.month
    val parts = month.split("-")
    val year = parts.getOrNull(0)?.toIntOrNull() ?: return
    val mon = parts.getOrNull(1)?.toIntOrNull() ?: return
    val leading = weekdaySunday0(year, mon, 1)
    val cells = buildList<Int?> {
        repeat(leading) { add(null) }
        for (day in 1..daysInMonth(year, mon)) add(day)
        while (size % 7 != 0) add(null)
    }
    Column(Modifier.card(12.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("‹", color = PortalColors.Blue, fontSize = 22.sp, modifier = Modifier.clickable { portal.shiftMonth(-1) }.padding(8.dp))
            Text(monthTitle(month), color = PortalColors.Ink, fontWeight = FontWeight.SemiBold)
            Text("›", color = PortalColors.Blue, fontSize = 22.sp, modifier = Modifier.clickable { portal.shiftMonth(1) }.padding(8.dp))
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
            listOf("S", "M", "T", "W", "T", "F", "S").forEach {
                Text(it, color = PortalColors.Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(36.dp), textAlign = TextAlign.Center)
            }
        }
        cells.chunked(7).forEach { week ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                week.forEach { day ->
                    val iso = day?.let { "$month-${it.toString().padStart(2, '0')}" }
                    val marked = iso != null && data?.attendanceDays?.any { it.workDate.take(10) == iso } == true
                    val off = iso != null && data?.dayOffs?.any { it.dayOffDate.take(10) == iso } == true
                    val wash = when {
                        off -> Color(0xFFFEF3C7)
                        marked -> PortalColors.Halo
                        else -> Color.Transparent
                    }
                    Box(
                        Modifier.padding(vertical = 3.dp).size(36.dp).clip(CircleShape).background(wash).clickable(enabled = day != null) { if (iso != null) portal.openDay(iso) },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(day?.toString().orEmpty(), color = PortalColors.Ink, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun PunchBox(label: String, value: String, recorded: Boolean, modifier: Modifier = Modifier) {
    Column(
        modifier.height(72.dp).clip(RoundedCornerShape(14.dp)).background(PortalColors.Field).border(1.dp, PortalColors.Line, RoundedCornerShape(14.dp)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(label, color = PortalColors.Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(4.dp))
        Text(value, color = if (recorded) PortalColors.Ink else PortalColors.Muted, fontSize = 15.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun MoneyRow(label: String, amount: String, danger: Boolean = false) {
    Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = PortalColors.Muted, fontSize = 13.sp, modifier = Modifier.weight(1f))
        Text(amount, color = if (danger) PortalColors.Danger else PortalColors.Ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun DetailLine(label: String, value: String, last: Boolean = false) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
        Text(label, color = PortalColors.Muted, fontSize = 12.sp)
        Text(value, color = PortalColors.Ink, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
    if (!last) Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp).height(1.dp).background(PortalColors.Line))
}

@Composable
private fun MemoGroup(items: List<Pair<Pair<String, String>, Int>>, onOpen: (Int) -> Unit) {
    Column(Modifier.card(8.dp)) {
        items.forEach { (copy, id) ->
            Row(Modifier.fillMaxWidth().clickable { onOpen(id) }.padding(horizontal = 8.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                IconBadge(Res.drawable.portal_person, PortalColors.Halo)
                Spacer(Modifier.size(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(copy.first, color = PortalColors.Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(copy.second, color = PortalColors.Muted, fontSize = 12.sp)
                }
                PortalIcon(Res.drawable.portal_chevron, 16.dp)
            }
        }
    }
}

@Composable
private fun Field(
    label: String,
    value: String,
    onValue: (String) -> Unit,
    placeholder: String,
    visual: VisualTransformation = VisualTransformation.None,
    keyboard: KeyboardOptions = KeyboardOptions.Default,
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
                onValueChange = onValue,
                singleLine = true,
                textStyle = TextStyle(color = PortalColors.Ink, fontSize = 14.sp),
                visualTransformation = visual,
                keyboardOptions = keyboard,
                cursorBrush = SolidColor(PortalColors.Blue),
                modifier = Modifier.weight(1f),
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
private fun Choice(label: String, selected: Boolean, onClick: () -> Unit) {
    Text(
        label,
        color = if (selected) PortalColors.Blue else PortalColors.Ink,
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier
            .clip(RoundedCornerShape(100.dp))
            .border(1.dp, if (selected) PortalColors.Blue else PortalColors.Line, RoundedCornerShape(100.dp))
            .background(if (selected) PortalColors.Halo else PortalColors.White)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    )
}

@Composable
private fun BlueButton(label: String, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        Modifier.fillMaxWidth().height(48.dp).clip(RoundedCornerShape(100.dp)).background(if (enabled) PortalColors.Blue else PortalColors.Line).clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
    }
}

@Composable
private fun OutlineAction(label: String, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).border(1.dp, Color(0xFFBFDBFE), RoundedCornerShape(12.dp)).clickable(onClick = onClick).padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PortalIcon(Res.drawable.portal_logout, 15.dp, PortalColors.Blue)
        Spacer(Modifier.size(8.dp))
        Text(label, color = PortalColors.Blue, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun Text(text: String, color: Color, fontSize: androidx.compose.ui.unit.TextUnit = 14.sp, fontWeight: FontWeight? = null, modifier: Modifier = Modifier, maxLines: Int = Int.MAX_VALUE, overflow: TextOverflow = TextOverflow.Clip, textAlign: TextAlign? = null, letterSpacing: androidx.compose.ui.unit.TextUnit = androidx.compose.ui.unit.TextUnit.Unspecified, lineHeight: androidx.compose.ui.unit.TextUnit = androidx.compose.ui.unit.TextUnit.Unspecified) {
    androidx.compose.material3.Text(
        text = text,
        color = color,
        fontSize = fontSize,
        fontWeight = fontWeight,
        modifier = modifier,
        maxLines = maxLines,
        overflow = overflow,
        textAlign = textAlign,
        letterSpacing = letterSpacing,
        lineHeight = lineHeight,
    )
}
