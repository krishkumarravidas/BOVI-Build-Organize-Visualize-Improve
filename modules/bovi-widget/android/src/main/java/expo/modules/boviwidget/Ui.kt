package expo.modules.boviwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/** Colours, formatting and intent helpers shared by all BOVI widgets (dark theme, matching the app). */
object Ui {
  const val TEXT = 0xFFF3F4F6.toInt()
  const val MUTED = 0xFF9CA3AF.toInt()
  const val PRIMARY = 0xFF818CF8.toInt()
  const val ACCENT = 0xFF2DD4BF.toInt()
  const val DANGER = 0xFFF87171.toInt()
  const val WARN = 0xFFFBBF24.toInt()
  const val SURFACE = 0xFF1C2130.toInt()
  const val FACE = 0xFF0B0F19.toInt()

  fun color(hex: String?, fallback: Int): Int =
    try {
      if (hex.isNullOrEmpty()) fallback else Color.parseColor(hex)
    } catch (e: IllegalArgumentException) {
      fallback
    }

  fun time(context: Context, ms: Long): String = android.text.format.DateFormat.getTimeFormat(context).format(Date(ms))

  fun midnight(t: Long): Long = Calendar.getInstance().apply {
    timeInMillis = t
    set(Calendar.HOUR_OF_DAY, 0)
    set(Calendar.MINUTE, 0)
    set(Calendar.SECOND, 0)
    set(Calendar.MILLISECOND, 0)
  }.timeInMillis

  /** Calendar-day difference between `now` and `ms` in local time. */
  fun daysFromToday(now: Long, ms: Long): Int = Math.round((midnight(ms) - midnight(now)) / 86_400_000.0).toInt()

  fun dayKey(ms: Long): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(ms))

  /** Midnight (local) of a `yyyy-MM-dd` key, or null. */
  fun parseDayKey(key: String?): Long? =
    try {
      if (key.isNullOrEmpty()) null else SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(key)?.time
    } catch (e: Exception) {
      null
    }

  /** "", "Tomorrow ", or "Wed " — prefix for a time on another day. */
  fun dayPrefix(now: Long, ms: Long): String = when (daysFromToday(now, ms)) {
    0 -> ""
    1 -> "Tomorrow "
    else -> SimpleDateFormat("EEE", Locale.getDefault()).format(Date(ms)) + " "
  }

  fun duration(ms: Long): String {
    val totalMin = (ms / 60_000).toInt()
    val h = totalMin / 60
    val m = totalMin % 60
    return if (h > 0) (if (m > 0) "${h}h ${m}m" else "${h}h") else "${m}m"
  }

  fun relativeDays(days: Int): String = when {
    days <= 0 -> "today"
    days == 1 -> "yesterday"
    else -> "$days days ago"
  }

  // ---------- JSON helpers (org.json returns "null" strings for JSON null, so be explicit) ----------

  fun str(o: JSONObject?, key: String): String? =
    if (o == null || o.isNull(key)) null else o.optString(key).takeIf { it.isNotEmpty() }

  fun objects(a: JSONArray?): List<JSONObject> {
    if (a == null) return emptyList()
    val out = ArrayList<JSONObject>(a.length())
    for (i in 0 until a.length()) a.optJSONObject(i)?.let { out.add(it) }
    return out
  }

  // ---------- intents ----------

  /** Opens the app at a route (Expo Router deep link, e.g. "bovi://exams"). */
  fun openUrl(context: Context, url: String): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(
      context,
      url.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /** A widget button: broadcasts `op` (plus string extras) to [ActionReceiver]. */
  fun action(context: Context, op: String, vararg extras: Pair<String, String>): PendingIntent {
    val intent = Intent(context, ActionReceiver::class.java).setAction(ActionReceiver.ACTION)
    intent.putExtra(ActionReceiver.EXTRA_OP, op)
    for ((k, v) in extras) intent.putExtra(k, v)
    // Unique request code per button so extras aren't shared between PendingIntents.
    val code = (op + extras.joinToString("|") { "${it.first}=${it.second}" }).hashCode()
    // The data URI also keeps intents distinct for the system's PendingIntent matching.
    intent.data = Uri.parse("bovi-widget://action/$code")
    return PendingIntent.getBroadcast(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Widget size in dp: width and height as currently shown in portrait. */
  fun sizeDp(manager: AppWidgetManager, id: Int, defaultW: Int, defaultH: Int): Pair<Int, Int> {
    val o = manager.getAppWidgetOptions(id)
    val w = o?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) ?: 0
    val h = o?.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0) ?: 0
    return Pair(if (w > 0) w else defaultW, if (h > 0) h else defaultH)
  }
}
