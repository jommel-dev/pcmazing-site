package com.pcmazing.portal.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

val portalJson = Json {
    ignoreUnknownKeys = true
    isLenient = true
    explicitNulls = false
    encodeDefaults = false
    coerceInputValues = true
}

@Serializable
data class PortalUser(
    val id: Int = 0,
    val username: String = "",
    val fullName: String = "",
    val email: String? = null,
    val role: String = "",
    val source: String = "",
    val payrollEnabled: Boolean = false,
    val profileImageUrl: String? = null,
    val accessToken: String = "",
)

@Serializable
data class LoginRequest(val username: String, val password: String)

@Serializable
data class LoginPayload(
    val accessToken: String,
    val user: PortalUser,
)

@Serializable
data class PasswordBody(val password: String)

@Serializable
data class TimeClockStatus(
    val username: String = "",
    val fullName: String = "",
    val employeeCode: String? = null,
    val workDate: String = "",
    val timeIn: String? = null,
    val timeOut: String? = null,
    val lunchOut: String? = null,
    val lunchIn: String? = null,
    val onLunch: Boolean = false,
    val canTimeIn: Boolean = false,
    val canLunchIn: Boolean = false,
    val canTimeOut: Boolean = false,
    val punchOutRequiresIntent: Boolean = false,
    val status: String = "",
    val message: String = "",
    val serverNow: String = "",
    val expectedLocation: String? = null,
)

@Serializable
data class WorkspaceDashboard(
    val workDate: String = "",
    val month: String = "",
    val today: TodayAttendance = TodayAttendance(),
    val monthSummary: MonthSummary = MonthSummary(),
    val overtimeNotice: NoticeCount? = null,
    val adjustmentNotice: NoticeCount? = null,
    val attendanceDays: List<AttendanceDay> = emptyList(),
    val dayOffs: List<DayOffItem> = emptyList(),
    val todos: List<TodoItem> = emptyList(),
    val activities: List<ActivityItem> = emptyList(),
    val payslips: List<PayslipItem> = emptyList(),
)

@Serializable
data class TodayAttendance(
    val timeIn: String? = null,
    val timeOut: String? = null,
    val hoursWorked: Double? = null,
    val status: String = "",
    val overtimeHours: Double? = null,
    val overtimeStatus: String? = null,
    val canRequestOvertime: Boolean = false,
    val attendanceId: Int? = null,
    val canRequestTimeOutAdjustment: Boolean = false,
    val adjustmentStatus: String? = null,
)

@Serializable
data class MonthSummary(
    val totalHours: Double = 0.0,
    val daysPresent: Int = 0,
    val daysCompleted: Int = 0,
    val dayOffCount: Int = 0,
)

@Serializable
data class NoticeCount(
    val eligibleCount: Int = 0,
    val pendingCount: Int = 0,
    val message: String? = null,
)

@Serializable
data class AttendanceDay(
    val id: Int? = null,
    val workDate: String = "",
    val timeIn: String? = null,
    val timeOut: String? = null,
    val hoursWorked: Double? = null,
    val overtimeHours: Double? = null,
    val overtimeStatus: String? = null,
    val canRequestOvertime: Boolean = false,
    val requestedTimeOut: String? = null,
    val adjustmentStatus: String? = null,
    val adjustmentNote: String? = null,
    val canRequestTimeOutAdjustment: Boolean = false,
)

@Serializable
data class DayOffItem(
    val id: Int = 0,
    val dayOffDate: String = "",
    val reason: String? = null,
)

@Serializable
data class TodoItem(
    val id: Int = 0,
    val title: String = "",
    val notes: String? = null,
    val dueDate: String = "",
    val isDone: Boolean = false,
)

@Serializable
data class ActivityItem(
    val id: Int = 0,
    val actionType: String = "",
    val title: String = "",
    val details: String? = null,
    val createdAt: String = "",
)

@Serializable
data class PayslipItem(
    val id: String = "",
    val label: String = "",
    val dateFrom: String = "",
    val dateTo: String = "",
    val periodDays: Int = 0,
    val daysPresent: Int = 0,
    val daysCompleted: Int = 0,
    val totalHours: Double = 0.0,
    val salaryType: String = "",
    val salaryAmount: Double? = null,
    val estimatedPay: Double = 0.0,
    val payrollEnabled: Boolean = false,
)

@Serializable
data class PayslipDetail(
    val id: String = "",
    val label: String = "",
    val dateFrom: String = "",
    val dateTo: String = "",
    val generatedAt: String = "",
    val employee: PayslipEmployee = PayslipEmployee(),
    val days: List<PayslipDay> = emptyList(),
    val totals: PayslipTotals = PayslipTotals(),
    val lines: List<PayslipLine> = emptyList(),
    val remarks: String? = null,
    val netPay: Double? = null,
    val breakdown: PayslipBreakdown? = null,
)

@Serializable
data class PayslipEmployee(
    val fullName: String = "",
    val positionTitle: String? = null,
    val username: String = "",
    val employeeCode: String? = null,
    val department: String? = null,
)

@Serializable
data class PayslipDay(
    val workDate: String = "",
    val timeInLabel: String = "",
    val timeOutLabel: String = "",
    val hoursWorked: Double = 0.0,
    val dayPay: Double = 0.0,
    val overtimeHours: Double = 0.0,
    val overtimeStatus: String = "",
    val overtimePay: Double = 0.0,
)

@Serializable
data class PayslipTotals(
    val daysPresent: Int = 0,
    val daysCompleted: Int = 0,
    val totalHours: Double = 0.0,
    val approvedOvertimeHours: Double = 0.0,
    val pendingOvertimeHours: Double = 0.0,
    val basePay: Double = 0.0,
    val overtimePay: Double = 0.0,
    val estimatedPay: Double = 0.0,
    val salaryTypeLabel: String? = null,
)

@Serializable
data class PayslipLine(
    val lineType: String = "",
    val label: String = "",
    val amount: Double = 0.0,
)

@Serializable
data class PayslipBreakdown(
    val grossPay: Double = 0.0,
    val totalDeductions: Double = 0.0,
    val netPay: Double = 0.0,
)

@Serializable
data class MemoListItem(
    val id: Int = 0,
    val memoNo: String = "",
    val memoType: String = "",
    val memoTypeLabel: String = "",
    val subject: String = "",
    val issuedAt: String? = null,
    val acknowledgedAt: String? = null,
    val issuedByName: String? = null,
)

@Serializable
data class MemoDetail(
    val id: Int = 0,
    val memoNo: String = "",
    val memoType: String = "",
    val memoTypeLabel: String = "",
    val subject: String = "",
    val issuedAt: String? = null,
    val acknowledgedAt: String? = null,
    val issuedByName: String? = null,
    val incidentDate: String? = null,
    val statementOfFacts: String = "",
    val policyViolated: String? = null,
    val directive: String? = null,
    val replyByDate: String? = null,
    val employeePosition: String? = null,
)

@Serializable
data class DayOffBody(val dayOffDate: String, val reason: String? = null)

@Serializable
data class TodoBody(
    val title: String,
    val notes: String? = null,
    val dueDate: String,
)

@Serializable
data class TodoPatch(
    val title: String? = null,
    val isDone: Boolean? = null,
)

@Serializable
data class ActionMessage(
    val message: String = "",
)

@Serializable
data class TimesheetRecord(
    val id: Int = 0,
    val fullName: String = "",
    val username: String = "",
    val periodFrom: String = "",
    val periodTo: String = "",
    val status: String = "",
    val totalHours: Double = 0.0,
    val daysPresent: Int = 0,
    val daysCompleted: Int = 0,
    val employeeNote: String? = null,
    val reviewNote: String? = null,
    val reviewedByName: String? = null,
    val finalizedByName: String? = null,
    val postedOn: String? = null,
)

@Serializable
data class TimesheetAttendance(
    val daysPresent: Int = 0,
    val daysCompleted: Int = 0,
    val totalHours: Double = 0.0,
)

@Serializable
data class TimesheetMine(
    val month: String = "",
    val periodFrom: String = "",
    val periodTo: String = "",
    val attendance: TimesheetAttendance = TimesheetAttendance(),
    val timesheet: TimesheetRecord? = null,
    val canReview: Boolean = false,
    val canFinalize: Boolean = false,
)

@Serializable
data class TimesheetSubmitBody(val month: String, val note: String? = null)

@Serializable
data class TimesheetNoteBody(val note: String? = null)

@Serializable
data class TimesheetFinalizeBody(val postedOn: String)

@Serializable
internal data class ApiEnvelope<T>(
    val success: Boolean = false,
    val message: String? = null,
    val data: T? = null,
)

@Serializable
internal data class ApiErrorBody(
    val message: String? = null,
    val error: String? = null,
)
