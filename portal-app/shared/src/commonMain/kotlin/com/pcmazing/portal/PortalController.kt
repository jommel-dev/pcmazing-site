package com.pcmazing.portal

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.ImageBitmap
import com.pcmazing.portal.clock.StampedSelfie
import com.pcmazing.portal.clock.openPdfBytes
import com.pcmazing.portal.data.AttendanceDay
import com.pcmazing.portal.data.MemoDetail
import com.pcmazing.portal.data.MemoListItem
import com.pcmazing.portal.data.PayslipDetail
import com.pcmazing.portal.data.PortalApi
import com.pcmazing.portal.data.PortalApiException
import com.pcmazing.portal.data.PortalSessionStore
import com.pcmazing.portal.data.PortalUser
import com.pcmazing.portal.data.TimeClockStatus
import com.pcmazing.portal.data.TimesheetMine
import com.pcmazing.portal.data.TimesheetRecord
import com.pcmazing.portal.data.WorkspaceDashboard
import com.pcmazing.portal.data.jwtExpiryMillis
import com.pcmazing.portal.data.portalApiBaseUrl
import com.pcmazing.portal.data.preparePortalApi
import com.pcmazing.portal.profile.decodeProfilePhoto
import kotlin.time.Clock
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

sealed interface Route {
    data object Splash : Route
    data object Login : Route
    data object Home : Route
    data object Attendance : Route
    data object Work : Route
    data object Pay : Route
    data object Profile : Route
    data object Clock : Route
    data object Memos : Route
    data object Notifications : Route
    data object Timesheet : Route
    data class Day(val date: String) : Route
    data class Payslip(val id: String) : Route
    data class Adjust(val attendanceId: Int, val workDate: String) : Route
}

class PortalController(
    private val api: PortalApi,
    private val scope: CoroutineScope,
) {
    var route by mutableStateOf<Route>(Route.Splash)
    var user by mutableStateOf<PortalUser?>(null)
    var avatar by mutableStateOf<ImageBitmap?>(null)
    var dashboard by mutableStateOf<WorkspaceDashboard?>(null)
    var clock by mutableStateOf<TimeClockStatus?>(null)
    var month by mutableStateOf(currentMonth())
    var memos by mutableStateOf<List<MemoListItem>>(emptyList())
    var pendingMemo by mutableStateOf<MemoDetail?>(null)
    var viewingMemo by mutableStateOf<MemoDetail?>(null)
    var payslip by mutableStateOf<PayslipDetail?>(null)
    var timesheet by mutableStateOf<TimesheetMine?>(null)
    var reviewQueue by mutableStateOf<List<TimesheetRecord>>(emptyList())
    var finalizeQueue by mutableStateOf<List<TimesheetRecord>>(emptyList())
    var loading by mutableStateOf(false)
    var busy by mutableStateOf(false)
    var error by mutableStateOf<String?>(null)
    var notice by mutableStateOf<String?>(null)
    var apiBase by mutableStateOf("")
    var includeRemarks by mutableStateOf(false)
    var readNotices by mutableStateOf(setOf<String>())

    private val stack = ArrayDeque<Route>()

    fun start(allowLocalApi: Boolean) {
        scope.launch {
            loading = true
            error = null
            preparePortalApi(allowLocalApi)
            apiBase = portalApiBaseUrl()
            val saved = PortalSessionStore.load()
            if (saved == null) {
                route = Route.Login
                loading = false
                return@launch
            }
            user = saved
            try {
                ensureFresh(saved)
                val token = user?.accessToken ?: saved.accessToken
                runCatching {
                    val profile = api.me(token)
                    user = profile.copy(accessToken = token)
                    PortalSessionStore.save(user ?: profile)
                }
                route = Route.Home
                refreshWorkspace()
                loadAvatar()
            } catch (cause: PortalApiException) {
                if (cause.status == 401) {
                    signOutLocal()
                    error = "Sign in again."
                } else {
                    route = Route.Home
                    error = cause.message
                }
            } finally {
                loading = false
            }
        }
    }

    fun login(username: String, password: String) {
        if (username.isBlank() || password.isBlank()) {
            error = "Enter your username and password."
            return
        }
        scope.launch {
            busy = true
            error = null
            try {
                val signedIn = api.login(username, password)
                user = signedIn
                PortalSessionStore.save(signedIn)
                loadAvatar()
                val status = api.timeClockStatus(signedIn.accessToken)
                clock = status
                route = if (status.canTimeIn) Route.Clock else Route.Home
                refreshWorkspace()
            } catch (cause: Exception) {
                error = cause.message ?: "Invalid username or password."
            } finally {
                busy = false
            }
        }
    }

    fun uploadProfileImage(jpeg: ByteArray) {
        if (jpeg.size > 2 * 1024 * 1024) {
            error = "Profile photo must be 2 MB or smaller."
            return
        }
        scope.launch {
            busy = true
            error = null
            try {
                val token = user?.accessToken.orEmpty()
                val profile = authed { api.uploadProfileImage(it, jpeg) }
                storeProfile(profile, token)
                notice = "Profile photo updated."
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                busy = false
            }
        }
    }

    fun removeProfileImage() {
        scope.launch {
            busy = true
            error = null
            try {
                val token = user?.accessToken.orEmpty()
                val profile = authed { api.removeProfileImage(it) }
                storeProfile(profile, token)
                notice = "Profile photo removed."
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                busy = false
            }
        }
    }

    private suspend fun storeProfile(profile: PortalUser, token: String) {
        val saved = profile.copy(accessToken = token.ifBlank { profile.accessToken })
        user = saved
        PortalSessionStore.save(saved)
        loadAvatar()
    }

    private suspend fun loadAvatar() {
        val path = user?.profileImageUrl?.trim().orEmpty()
        avatar = if (path.isBlank()) {
            null
        } else {
            runCatching { decodeProfilePhoto(api.fetchBytes(path)) }.getOrNull()
        }
    }

    fun markNoticeRead(id: String) {
        readNotices = readNotices + id
    }

    fun markNoticesRead(ids: Collection<String>) {
        readNotices = readNotices + ids
    }

    fun loadTimesheet() {
        scope.launch {
            loading = true
            error = null
            try {
                val month = month.ifBlank { currentMonth() }
                timesheet = authed { api.myTimesheet(it, month) }
                if (timesheet?.canReview == true) {
                    reviewQueue = authed { api.reviewTimesheets(it) }
                }
                if (timesheet?.canFinalize == true) {
                    finalizeQueue = authed { api.finalizeTimesheets(it) }
                }
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                loading = false
            }
        }
    }

    fun submitTimesheet(note: String) {
        scope.launch {
            busy = true
            error = null
            try {
                authed { api.submitTimesheet(it, month, note) }
                notice = "Timesheet sent to the COO and CEO."
                loadTimesheet()
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                busy = false
            }
        }
    }

    fun approveTimesheet(id: Int, note: String) {
        scope.launch {
            busy = true
            error = null
            try {
                authed { api.approveTimesheet(it, id, note) }
                notice = "Timesheet approved. The founder can now post the payslip."
                loadTimesheet()
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                busy = false
            }
        }
    }

    fun revertTimesheet(id: Int, note: String) {
        if (note.isBlank()) {
            error = "Explain what should be rechecked."
            return
        }
        scope.launch {
            busy = true
            error = null
            try {
                authed { api.revertTimesheet(it, id, note) }
                notice = "Timesheet sent back for recheck."
                loadTimesheet()
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                busy = false
            }
        }
    }

    fun finalizeTimesheet(id: Int, postedOn: String) {
        if (!Regex("""\d{4}-\d{2}-\d{2}""").matches(postedOn)) {
            error = "Enter the post date as YYYY-MM-DD."
            return
        }
        scope.launch {
            busy = true
            error = null
            try {
                authed { api.finalizeTimesheet(it, id, postedOn) }
                notice = "Payslip will show on $postedOn."
                loadTimesheet()
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                busy = false
            }
        }
    }

    fun logout() {
        signOutLocal()
        notice = null
        error = null
    }

    fun tab(next: Route) {
        stack.clear()
        error = null
        route = next
    }

    fun open(next: Route) {
        if (route != next) stack.addLast(route)
        error = null
        route = next
    }

    fun back() {
        if (pendingMemo != null || viewingMemo != null) {
            viewingMemo = null
            return
        }
        error = null
        route = if (stack.isEmpty()) Route.Home else stack.removeLast()
    }

    fun shiftMonth(delta: Int) {
        month = shiftMonth(month, delta)
        scope.launch { reloadDashboard() }
    }

    fun openDay(date: String) {
        open(Route.Day(date))
    }

    fun openPayslip(id: String) {
        payslip = null
        open(Route.Payslip(id))
        scope.launch {
            busy = true
            error = null
            try {
                payslip = authed { api.payslip(it, id) }
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                busy = false
            }
        }
    }

    fun openPdf() {
        val slip = payslip ?: return
        scope.launch {
            busy = true
            error = null
            try {
                val bytes = authed { api.payslipPdf(it, slip.id, includeRemarks) }
                val problem = openPdfBytes("payslip-${slip.dateFrom}_${slip.dateTo}.pdf", bytes)
                notice = problem ?: "Payslip opened."
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                busy = false
            }
        }
    }

    fun openMemo(id: Int) {
        scope.launch {
            busy = true
            try {
                viewingMemo = authed { api.memo(it, id) }
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                busy = false
            }
        }
    }

    fun acknowledgePending() {
        val memo = pendingMemo ?: return
        scope.launch {
            busy = true
            error = null
            try {
                authed { api.acknowledgeMemo(it, memo.id) }
                pendingMemo = null
                loadMemos()
                notice = "Memo acknowledged."
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                busy = false
            }
        }
    }

    fun refresh() {
        scope.launch { refreshWorkspace() }
    }

    fun punchIn(workLocation: String, selfie: StampedSelfie) {
        if (workLocation == "wfh" && !selfie.hasFix) {
            error = "Turn on location before a work-from-home time in."
            return
        }
        scope.launch {
            busy = true
            error = null
            notice = null
            try {
                val jpeg = requireSelfie(selfie.jpegBytes)
                clock = authed { token ->
                    api.timeIn(
                        token,
                        jpeg,
                        workLocation,
                        if (workLocation == "wfh") selfie.latitude else null,
                        if (workLocation == "wfh") selfie.longitude else null,
                        if (workLocation == "wfh") selfie.placeName else null,
                    )
                }
                notice = if (clock?.canTimeOut == true) "Time in recorded." else "Punch recorded."
                reloadDashboard()
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                busy = false
            }
        }
    }

    fun punchOut(intent: String, selfie: StampedSelfie) {
        scope.launch {
            busy = true
            error = null
            notice = null
            try {
                clock = authed { api.timeOut(it, requireSelfie(selfie.jpegBytes), intent) }
                notice = if (intent == "lunch") "Lunch out recorded." else "Time out recorded."
                reloadDashboard()
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                busy = false
            }
        }
    }

    fun requestOvertime(day: AttendanceDay) {
        val id = day.id ?: return
        scope.launch {
            busy = true
            error = null
            try {
                notice = authed { api.requestOvertime(it, id) }
                reloadDashboard()
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                busy = false
            }
        }
    }

    fun submitAdjustment(
        attendanceId: Int,
        requestedTimeOut: String,
        note: String,
        category: String,
        selfie: StampedSelfie,
    ) {
        if (!requestedTimeOut.contains('T')) {
            error = "Enter the time you left as YYYY-MM-DDTHH:mm."
            return
        }
        if (note.isBlank()) {
            error = "Explain why you missed clocking out."
            return
        }
        scope.launch {
            busy = true
            error = null
            try {
                notice = authed {
                    api.requestTimeOut(it, attendanceId, requireSelfie(selfie.jpegBytes), requestedTimeOut, note.trim(), category)
                }
                reloadDashboard()
                back()
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                busy = false
            }
        }
    }

    fun saveDayOff(date: String, reason: String) {
        scope.launch {
            busy = true
            error = null
            try {
                authed { api.saveDayOff(it, date, reason) }
                notice = "Day off saved."
                reloadDashboard()
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                busy = false
            }
        }
    }

    fun removeDayOff(id: Int) {
        scope.launch {
            busy = true
            try {
                authed { api.deleteDayOff(it, id) }
                notice = "Day off removed."
                reloadDashboard()
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                busy = false
            }
        }
    }

    fun addTodo(date: String, title: String) {
        if (title.isBlank()) {
            error = "Enter a todo."
            return
        }
        scope.launch {
            busy = true
            error = null
            try {
                authed { api.createTodo(it, title.trim(), date) }
                reloadDashboard()
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                busy = false
            }
        }
    }

    fun toggleTodo(id: Int, isDone: Boolean) {
        scope.launch {
            try {
                authed { api.updateTodo(it, id, isDone) }
                reloadDashboard()
            } catch (cause: Exception) {
                error = cause.message
            }
        }
    }

    fun deleteTodo(id: Int) {
        scope.launch {
            try {
                authed { api.deleteTodo(it, id) }
                reloadDashboard()
            } catch (cause: Exception) {
                error = cause.message
            }
        }
    }

    fun changePassword(password: String) {
        if (password.length < 6) {
            error = "Password must be at least 6 characters."
            return
        }
        scope.launch {
            busy = true
            error = null
            try {
                val token = user?.accessToken.orEmpty()
                val profile = authed { api.changePassword(it, password) }
                storeProfile(profile, token)
                notice = "Password updated."
            } catch (cause: Exception) {
                error = cause.message
            } finally {
                busy = false
            }
        }
    }

    private suspend fun refreshWorkspace() {
        loading = true
        error = null
        try {
            reloadDashboard()
            clock = authed { api.timeClockStatus(it) }
            loadMemos()
        } catch (cause: Exception) {
            error = cause.message
        } finally {
            loading = false
        }
    }

    private suspend fun reloadDashboard() {
        val data = authed { api.dashboard(it, month) }
        dashboard = data
        if (month.isBlank()) month = data.month.ifBlank { currentMonth() }
    }

    private suspend fun loadMemos() {
        try {
            val pending = authed { api.pendingMemos(it) }
            memos = authed { api.memos(it) }
            if (pendingMemo == null) pendingMemo = pending.firstOrNull()
        } catch (_: Exception) {
            // Memos stay optional if that table is not ready.
        }
    }

    private suspend fun ensureFresh(current: PortalUser): String {
        val exp = jwtExpiryMillis(current.accessToken) ?: return current.accessToken
        val remaining = exp - Clock.System.now().toEpochMilliseconds()
        if (remaining > 15 * 60 * 1000) return current.accessToken
        val refreshed = api.refresh(current.accessToken)
        user = refreshed
        PortalSessionStore.save(refreshed)
        return refreshed.accessToken
    }

    private suspend fun <T> authed(block: suspend (String) -> T): T {
        val current = user ?: throw PortalApiException("Sign in again.", 401)
        val token = try {
            ensureFresh(current)
        } catch (cause: PortalApiException) {
            if (cause.status == 401) signOutLocal()
            throw cause
        }
        return try {
            block(token)
        } catch (cause: PortalApiException) {
            if (cause.status != 401) throw cause
            val refreshed = try {
                api.refresh(user?.accessToken ?: token)
            } catch (refreshError: PortalApiException) {
                signOutLocal()
                throw refreshError
            }
            user = refreshed
            PortalSessionStore.save(refreshed)
            block(refreshed.accessToken)
        }
    }

    private fun signOutLocal() {
        PortalSessionStore.clear()
        user = null
        avatar = null
        dashboard = null
        clock = null
        payslip = null
        pendingMemo = null
        viewingMemo = null
        stack.clear()
        route = Route.Login
    }

    private fun requireSelfie(bytes: ByteArray): ByteArray {
        if (bytes.size > 2 * 1024 * 1024) {
            throw PortalApiException("Selfie is larger than 2 MB. Retake the photo.")
        }
        if (bytes.isEmpty()) throw PortalApiException("Take a selfie first.")
        return bytes
    }
}
