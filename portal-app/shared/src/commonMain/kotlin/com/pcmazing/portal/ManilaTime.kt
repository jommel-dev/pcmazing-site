package com.pcmazing.portal

import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.round

internal fun isoToEpochMillis(iso: String): Long? {
    val match = Regex("""(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?""")
        .find(iso.trim()) ?: return null
    val year = match.groupValues[1].toInt()
    val month = match.groupValues[2].toInt()
    val day = match.groupValues[3].toInt()
    val hour = match.groupValues[4].toLong()
    val minute = match.groupValues[5].toLong()
    val second = match.groupValues[6].toLongOrNull() ?: 0L
    val days = civilEpochDay(year, month, day).toLong()
    val local = days * 86_400_000L + hour * 3_600_000L + minute * 60_000L + second * 1_000L
    val zone = match.groupValues[7]
    val offset = if (zone.isBlank()) 8L * 3_600_000L else zoneOffsetMillis(zone)
    return local - offset
}

internal fun formatManila(iso: String?, withDate: Boolean = false): String {
    if (iso.isNullOrBlank()) return "—"
    val utc = isoToEpochMillis(iso) ?: return iso
    val parts = epochUtcParts(utc + 8L * 3_600_000L)
    val clock = formatClock(parts.hour, parts.minute)
    if (!withDate) return clock
    return "${monthName(parts.month)} ${parts.day}, ${parts.year}  $clock"
}

private fun twoDigits(value: Int): String = value.toString().padStart(2, '0')

private fun fourDigits(value: Int): String = value.toString().padStart(4, '0')

internal fun formatHours(value: Double?): String {
    if (value == null) return "—"
    val rounded = round(value * 100.0) / 100.0
    val text = rounded.toString()
    return if (text.contains('.')) "${text.trimEnd('0').trimEnd('.')} h" else "$text h"
}

internal fun formatMoney(value: Double?): String {
    if (value == null) return "—"
    val cents = round(value * 100.0).toLong()
    val sign = if (cents < 0) "-" else ""
    val absCents = abs(cents)
    val whole = absCents / 100
    val frac = (absCents % 100).toString().padStart(2, '0')
    return "$sign₱$whole.$frac"
}

internal fun currentMonth(): String {
    val now = kotlin.time.Clock.System.now().toEpochMilliseconds()
    val parts = epochUtcParts(now + 8L * 3_600_000L)
    return "${fourDigits(parts.year)}-${twoDigits(parts.month)}"
}

internal fun shiftMonth(month: String, delta: Int): String {
    val parts = month.split('-')
    val year = parts.getOrNull(0)?.toIntOrNull() ?: return month
    val mon = parts.getOrNull(1)?.toIntOrNull() ?: return month
    var index = year * 12 + (mon - 1) + delta
    var nextYear = floor(index / 12.0).toInt()
    var nextMonth = index - nextYear * 12 + 1
    if (nextMonth < 1) {
        nextMonth += 12
        nextYear -= 1
    }
    return "${fourDigits(nextYear)}-${twoDigits(nextMonth)}"
}

internal fun daysInMonth(year: Int, month: Int): Int = when (month) {
    1, 3, 5, 7, 8, 10, 12 -> 31
    4, 6, 9, 11 -> 30
    2 -> if (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)) 29 else 28
    else -> 30
}

internal fun weekdaySunday0(year: Int, month: Int, day: Int): Int {
    val epoch = civilEpochDay(year, month, day)
    val mod = (epoch + 4) % 7
    return if (mod < 0) mod + 7 else mod
}

internal fun monthTitle(month: String): String {
    val parts = month.split('-')
    val year = parts.getOrNull(0) ?: return month
    val mon = parts.getOrNull(1)?.toIntOrNull() ?: return month
    return "${monthName(mon)} $year"
}

private fun formatClock(hour: Int, minute: Int): String {
    val suffix = if (hour >= 12) "PM" else "AM"
    val hour12 = when (val h = hour % 12) {
        0 -> 12
        else -> h
    }
    return "$hour12:${twoDigits(minute)} $suffix"
}

private fun monthName(month: Int): String = listOf(
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
).getOrElse(month - 1) { month.toString() }

private data class CivilParts(val year: Int, val month: Int, val day: Int, val hour: Int, val minute: Int)

private fun epochUtcParts(utcMillis: Long): CivilParts {
    val days = floorDiv(utcMillis, 86_400_000L)
    var time = utcMillis - days * 86_400_000L
    if (time < 0) time += 86_400_000L
    val hour = (time / 3_600_000L).toInt()
    val minute = ((time % 3_600_000L) / 60_000L).toInt()
    val date = civilFromEpochDay(days.toInt())
    return CivilParts(date.first, date.second, date.third, hour, minute)
}

private fun floorDiv(value: Long, divisor: Long): Long {
    var result = value / divisor
    if (value < 0 && value % divisor != 0L) result -= 1
    return result
}

private fun zoneOffsetMillis(zone: String): Long {
    if (zone == "Z") return 0L
    val sign = if (zone.startsWith('-')) -1L else 1L
    val parts = zone.drop(1).split(':')
    val hours = parts[0].toLongOrNull() ?: return 0L
    val minutes = parts.getOrNull(1)?.toLongOrNull() ?: 0L
    return sign * (hours * 3_600_000L + minutes * 60_000L)
}

private fun civilEpochDay(year: Int, month: Int, day: Int): Int {
    val y = if (month <= 2) year - 1 else year
    val era = if (y >= 0) y / 400 else (y - 399) / 400
    val yoe = y - era * 400
    val m = month + if (month > 2) -3 else 9
    val doy = (153 * m + 2) / 5 + day - 1
    val doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
    return era * 146097 + doe - 719468
}

private fun civilFromEpochDay(z: Int): Triple<Int, Int, Int> {
    var days = z + 719468
    val era = if (days >= 0) days / 146097 else (days - 146096) / 146097
    val doe = days - era * 146097
    val yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
    val y = yoe + era * 400
    val doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
    val mp = (5 * doy + 2) / 153
    val d = doy - (153 * mp + 2) / 5 + 1
    val m = mp + if (mp < 10) 3 else -9
    val year = y + if (m <= 2) 1 else 0
    return Triple(year, m, d)
}
