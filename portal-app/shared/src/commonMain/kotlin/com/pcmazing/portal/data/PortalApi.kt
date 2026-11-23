package com.pcmazing.portal.data

import io.ktor.client.HttpClient
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.delete
import io.ktor.client.request.forms.MultiPartFormDataContent
import io.ktor.client.request.forms.formData
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsBytes
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.TextContent
import io.ktor.http.isSuccess
import kotlinx.serialization.Serializable

class PortalApiException(
    message: String,
    val status: Int? = null,
) : Exception(message)

class PortalApi(
    private val client: HttpClient,
) {
    suspend fun login(username: String, password: String): PortalUser {
        val payload = postPublic<LoginPayload>(
            "/auth/portal-login",
            LoginRequest(username.trim(), password),
            "Invalid username or password.",
        )
        return payload.user.copy(accessToken = payload.accessToken)
    }

    suspend fun refresh(token: String): PortalUser {
        val payload = send<LoginPayload>(token, "Could not extend the session.") {
            client.post(url("/auth/refresh")) {
                bearer(token)
                jsonBody(EmptyBody())
            }
        }
        return payload.user.copy(accessToken = payload.accessToken)
    }

    suspend fun me(token: String): PortalUser = get(token, "/auth/me", "Could not load your profile.")

    suspend fun changePassword(token: String, password: String): PortalUser =
        send(token, "Could not change the password.") {
            client.patch(url("/auth/me/password")) {
                bearer(token)
                jsonBody(PasswordBody(password))
            }
        }

    suspend fun uploadProfileImage(token: String, jpeg: ByteArray): PortalUser =
        send(token, "Could not update the profile photo.") {
            client.post(url("/auth/me/profile-image")) {
                bearer(token)
                setBody(
                    MultiPartFormDataContent(
                        formData { appendJpeg("file", "profile.jpg", jpeg) },
                    ),
                )
            }
        }

    suspend fun removeProfileImage(token: String): PortalUser =
        send(token, "Could not remove the profile photo.") {
            client.delete(url("/auth/me/profile-image")) { bearer(token) }
        }

    suspend fun fetchBytes(pathOrUrl: String): ByteArray {
        val target = if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
            pathOrUrl
        } else {
            url(pathOrUrl)
        }
        val response = client.get(target)
        if (!response.status.isSuccess()) {
            throw PortalApiException("Could not load the profile photo.", response.status.value)
        }
        return response.bodyAsBytes()
    }

    suspend fun dashboard(token: String, month: String): WorkspaceDashboard =
        get(token, "/admin/employee-workspace/dashboard?month=$month", "Could not load your dashboard.")

    suspend fun timeClockStatus(token: String): TimeClockStatus =
        get(token, "/admin/employee-workspace/time-clock/status", "Could not load the time clock.")

    suspend fun timeIn(
        token: String,
        selfie: ByteArray,
        workLocationType: String,
        latitude: Double?,
        longitude: Double?,
        locationLabel: String?,
    ): TimeClockStatus = send(token, "Could not record time in.") {
        client.post(url("/admin/employee-workspace/time-clock/time-in")) {
            bearer(token)
            setBody(
                MultiPartFormDataContent(
                    formData {
                        append("workLocationType", workLocationType)
                        if (latitude != null && longitude != null) {
                            append("locationLat", latitude.toString())
                            append("locationLng", longitude.toString())
                        }
                        if (!locationLabel.isNullOrBlank()) {
                            append("locationLabel", locationLabel.take(200))
                        }
                        appendJpeg("selfie", "time-in-selfie.jpg", selfie)
                    },
                ),
            )
        }
    }

    suspend fun timeOut(token: String, selfie: ByteArray, intent: String?): TimeClockStatus =
        send(token, "Could not record time out.") {
            client.post(url("/admin/employee-workspace/time-clock/time-out")) {
                bearer(token)
                setBody(
                    MultiPartFormDataContent(
                        formData {
                            if (intent == "lunch" || intent == "end_of_day") {
                                append("intent", intent)
                            }
                            appendJpeg("selfie", "time-out-selfie.jpg", selfie)
                        },
                    ),
                )
            }
        }

    suspend fun myTimesheet(token: String, month: String): TimesheetMine =
        get(token, "/admin/employee-workspace/timesheet?month=$month", "Could not load the timesheet.")

    suspend fun submitTimesheet(token: String, month: String, note: String): TimesheetRecord =
        send(token, "Could not send the timesheet.") {
            client.post(url("/admin/employee-workspace/timesheet/submit")) {
                bearer(token)
                jsonBody(TimesheetSubmitBody(month, note.ifBlank { null }))
            }
        }

    suspend fun reviewTimesheets(token: String): List<TimesheetRecord> =
        get(token, "/admin/employee-workspace/timesheets/review", "Could not load timesheets waiting for review.")

    suspend fun approveTimesheet(token: String, id: Int, note: String): TimesheetRecord =
        send(token, "Could not approve the timesheet.") {
            client.post(url("/admin/employee-workspace/timesheets/$id/approve")) {
                bearer(token)
                jsonBody(TimesheetNoteBody(note.ifBlank { null }))
            }
        }

    suspend fun revertTimesheet(token: String, id: Int, note: String): TimesheetRecord =
        send(token, "Could not send the timesheet back.") {
            client.post(url("/admin/employee-workspace/timesheets/$id/revert")) {
                bearer(token)
                jsonBody(TimesheetNoteBody(note.ifBlank { null }))
            }
        }

    suspend fun finalizeTimesheets(token: String): List<TimesheetRecord> =
        get(token, "/admin/employee-workspace/timesheets/finalize", "Could not load payslips waiting to be posted.")

    suspend fun finalizeTimesheet(token: String, id: Int, postedOn: String): TimesheetRecord =
        send(token, "Could not post the payslip.") {
            client.post(url("/admin/employee-workspace/timesheets/$id/finalize")) {
                bearer(token)
                jsonBody(TimesheetFinalizeBody(postedOn))
            }
        }

    suspend fun payslip(token: String, id: String): PayslipDetail =
        get(token, "/admin/employee-workspace/payslips/$id", "Could not load the payslip.")

    suspend fun payslipPdf(token: String, id: String, includeRemarks: Boolean): ByteArray {
        val remarks = if (includeRemarks) "1" else "0"
        val response = client.get(url("/admin/employee-workspace/payslips/$id/pdf?download=1&includeRemarks=$remarks")) {
            bearer(token)
        }
        if (response.status == HttpStatusCode.Unauthorized) {
            throw PortalApiException(messageOf(response.bodyAsText(), "Sign in again."), 401)
        }
        if (!response.status.isSuccess()) {
            throw PortalApiException(messageOf(response.bodyAsText(), "Could not open the payslip PDF."), response.status.value)
        }
        return response.bodyAsBytes()
    }

    suspend fun requestOvertime(token: String, attendanceId: Int): String {
        val body = send<ActionMessage>(token, "Could not submit overtime.") {
            client.post(url("/admin/employee-workspace/overtime/$attendanceId/request")) {
                bearer(token)
                jsonBody(EmptyBody())
            }
        }
        return body.message.ifBlank { "Overtime request submitted." }
    }

    suspend fun requestTimeOut(
        token: String,
        attendanceId: Int,
        selfie: ByteArray,
        requestedTimeOut: String,
        note: String,
        undertimeCategory: String,
    ): String {
        val body = send<ActionMessage>(token, "Could not submit the time-out request.") {
            client.post(url("/admin/employee-workspace/attendance/$attendanceId/request-time-out")) {
                bearer(token)
                setBody(
                    MultiPartFormDataContent(
                        formData {
                            append("requestedTimeOut", requestedTimeOut)
                            append("note", note)
                            append("undertimeCategory", undertimeCategory)
                            appendJpeg("selfie", "time-out-adjustment.jpg", selfie)
                        },
                    ),
                )
            }
        }
        return body.message.ifBlank { "Time-out request submitted." }
    }

    suspend fun saveDayOff(token: String, date: String, reason: String?): DayOffItem =
        send(token, "Could not save the day off.") {
            client.put(url("/admin/employee-workspace/day-offs")) {
                bearer(token)
                jsonBody(DayOffBody(date, reason?.takeIf { it.isNotBlank() }))
            }
        }

    suspend fun deleteDayOff(token: String, id: Int) {
        sendMessage(token, "Could not remove the day off.") {
            client.delete(url("/admin/employee-workspace/day-offs/$id")) {
                bearer(token)
            }
        }
    }

    suspend fun createTodo(token: String, title: String, dueDate: String): TodoItem =
        send(token, "Could not add the todo.") {
            client.post(url("/admin/employee-workspace/todos")) {
                bearer(token)
                jsonBody(TodoBody(title = title, dueDate = dueDate))
            }
        }

    suspend fun updateTodo(token: String, id: Int, isDone: Boolean): TodoItem =
        send(token, "Could not update the todo.") {
            client.patch(url("/admin/employee-workspace/todos/$id")) {
                bearer(token)
                jsonBody(TodoPatch(isDone = isDone))
            }
        }

    suspend fun deleteTodo(token: String, id: Int) {
        sendMessage(token, "Could not delete the todo.") {
            client.delete(url("/admin/employee-workspace/todos/$id")) {
                bearer(token)
            }
        }
    }

    suspend fun memos(token: String): List<MemoListItem> =
        get(token, "/admin/employee-workspace/memos", "Could not load memos.")

    suspend fun pendingMemos(token: String): List<MemoDetail> =
        get(token, "/admin/employee-workspace/memos/pending", "Could not load memos.")

    suspend fun memo(token: String, id: Int): MemoDetail =
        get(token, "/admin/employee-workspace/memos/$id", "Could not open the memo.")

    suspend fun acknowledgeMemo(token: String, id: Int): MemoDetail =
        send(token, "Could not acknowledge the memo.") {
            client.post(url("/admin/employee-workspace/memos/$id/acknowledge")) {
                bearer(token)
                jsonBody(EmptyBody())
            }
        }

    private suspend inline fun <reified T> get(token: String, path: String, fallback: String): T =
        send(token, fallback) {
            client.get(url(path)) { bearer(token) }
        }

    private suspend inline fun <reified T> postPublic(path: String, body: Any, fallback: String): T {
        val response = client.post(url(path)) { jsonBody(body) }
        return decode(response, fallback)
    }

    private suspend inline fun <reified T> send(
        token: String,
        fallback: String,
        crossinline block: suspend () -> HttpResponse,
    ): T = decode(block(), fallback)

    private suspend inline fun sendMessage(
        token: String,
        fallback: String,
        crossinline block: suspend () -> HttpResponse,
    ) {
        val response = block()
        if (response.status == HttpStatusCode.Unauthorized) {
            throw PortalApiException(messageOf(response.bodyAsText(), "Sign in again."), 401)
        }
        if (!response.status.isSuccess()) {
            throw PortalApiException(messageOf(response.bodyAsText(), fallback), response.status.value)
        }
    }

    private suspend inline fun <reified T> decode(response: HttpResponse, fallback: String): T {
        val text = response.bodyAsText()
        if (response.status == HttpStatusCode.Unauthorized) {
            throw PortalApiException(messageOf(text, "Sign in again."), 401)
        }
        if (!response.status.isSuccess()) {
            throw PortalApiException(messageOf(text, fallback), response.status.value)
        }
        val envelope = runCatching { portalJson.decodeFromString<ApiEnvelope<T>>(text) }.getOrNull()
        if (envelope?.data != null) return envelope.data
        if (envelope?.success == false) {
            throw PortalApiException(envelope.message ?: fallback, response.status.value)
        }
        return runCatching { portalJson.decodeFromString<T>(text) }.getOrElse {
            throw PortalApiException(envelope?.message ?: fallback, response.status.value)
        }
    }

    private fun messageOf(text: String, fallback: String): String {
        val parsed = runCatching { portalJson.decodeFromString<ApiErrorBody>(text) }.getOrNull()
        return parsed?.message?.takeIf { it.isNotBlank() }
            ?: parsed?.error?.takeIf { it.isNotBlank() }
            ?: fallback
    }

    private fun url(path: String): String = portalApiBaseUrl().trimEnd('/') + path

    private fun HttpRequestBuilder.bearer(token: String) {
        if (token.isBlank()) throw PortalApiException("Sign in again.", 401)
        header(HttpHeaders.Authorization, "Bearer $token")
    }

    private fun HttpRequestBuilder.jsonBody(body: Any) {
        val json = when (body) {
            is LoginRequest -> portalJson.encodeToString(body)
            is PasswordBody -> portalJson.encodeToString(body)
            is DayOffBody -> portalJson.encodeToString(body)
            is TodoBody -> portalJson.encodeToString(body)
            is TodoPatch -> portalJson.encodeToString(body)
            is TimesheetSubmitBody -> portalJson.encodeToString(body)
            is TimesheetNoteBody -> portalJson.encodeToString(body)
            is TimesheetFinalizeBody -> portalJson.encodeToString(body)
            is EmptyBody -> "{}"
            else -> throw PortalApiException("Unsupported request.")
        }
        header(HttpHeaders.ContentType, "application/json")
        setBody(TextContent(json, ContentType.Application.Json))
    }
}

@Serializable
private class EmptyBody

private fun io.ktor.client.request.forms.FormBuilder.appendJpeg(name: String, filename: String, bytes: ByteArray) {
    append(
        name,
        bytes,
        Headers.build {
            append(HttpHeaders.ContentType, "image/jpeg")
            append(HttpHeaders.ContentDisposition, "filename=\"$filename\"")
        },
    )
}
