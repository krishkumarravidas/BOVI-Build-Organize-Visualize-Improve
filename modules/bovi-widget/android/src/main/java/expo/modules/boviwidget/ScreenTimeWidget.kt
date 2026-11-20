package expo.modules.boviwidget

import android.Manifest
import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import kotlin.math.max

/** Today's screen time vs. your limit, with the top apps — read straight from Android, always current. */
object ScreenTimeWidget {
  private const val ROW_DP = 30
  private const val HEADER_DP = 96

  fun render(context: Context, manager: AppWidgetManager, id: Int, data: JSONObject?, now: Long): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.bw_screentime)
    views.setOnClickPendingIntent(R.id.bw_root, Ui.openUrl(context, "bovi://screen-time"))
    views.setTextViewText(R.id.bw_title, "SCREEN TIME")
    views.setTextViewText(R.id.bw_header_meta, "today")
    views.removeAllViews(R.id.bw_rows)

    if (!Usage.hasAccess(context)) {
      views.setTextViewText(R.id.bw_st_total, "—")
      views.setTextViewText(R.id.bw_st_limit, "")
      views.setViewVisibility(R.id.bw_st_progress, View.GONE)
      views.setTextViewText(R.id.bw_empty, "Tap to allow usage access in BOVI")
      views.setViewVisibility(R.id.bw_empty, View.VISIBLE)
      return views
    }
    val apps = Usage.today(context, now)
    val total = apps.sumOf { it.second }
    views.setTextViewText(R.id.bw_st_total, Ui.duration(total))

    val limitMin = if (data == null || data.isNull("screenLimitMin")) 0 else data.optInt("screenLimitMin")
    if (limitMin > 0) {
      val limitMs = limitMin * 60_000L
      val ratio = total.toDouble() / limitMs
      val color = when {
        ratio >= 1 -> Ui.DANGER
        ratio >= 0.8 -> Ui.WARN
        else -> Ui.ACCENT
      }
      views.setTextViewText(
        R.id.bw_st_limit,
        if (ratio >= 1) "${Ui.duration(total - limitMs)} over your ${Ui.duration(limitMs)} limit" else "of ${Ui.duration(limitMs)} · ${Ui.duration(limitMs - total)} left",
      )
      views.setTextColor(R.id.bw_st_total, color)
      views.setViewVisibility(R.id.bw_st_progress, View.VISIBLE)
      views.setProgressBar(R.id.bw_st_progress, 1000, (ratio.coerceAtMost(1.0) * 1000).toInt(), false)
      Schedule.tintProgress(views, R.id.bw_st_progress, color)
    } else {
      views.setTextViewText(R.id.bw_st_limit, "no daily limit set")
      views.setTextColor(R.id.bw_st_total, Ui.TEXT)
      views.setViewVisibility(R.id.bw_st_progress, View.GONE)
    }

    if (apps.isEmpty()) {
      views.setTextViewText(R.id.bw_empty, "No app use yet today")
      views.setViewVisibility(R.id.bw_empty, View.VISIBLE)
      return views
    }
    views.setViewVisibility(R.id.bw_empty, View.GONE)
    val (_, h) = Ui.sizeDp(manager, id, 250, 180)
    val capacity = max(0, (h - HEADER_DP) / ROW_DP).coerceAtMost(5)
    val top = apps.first().second.coerceAtLeast(1)
    for ((label, ms) in apps.filter { it.second >= 60_000L }.take(capacity)) {
      val row = RemoteViews(context.packageName, R.layout.bw_row_bar)
      row.setTextViewText(R.id.bw_row_title, label)
      row.setTextViewText(R.id.bw_row_meta, Ui.duration(ms))
      row.setTextColor(R.id.bw_row_meta, Ui.MUTED)
      row.setProgressBar(R.id.bw_row_progress, 1000, (ms * 1000 / top).toInt(), false)
      Schedule.tintProgress(row, R.id.bw_row_progress, Ui.PRIMARY)
      views.addView(R.id.bw_rows, row)
    }
    return views
  }
}

/** Foreground time per app (same method as the screen-time module, kept here so widgets work standalone). */
object Usage {
  private const val EVENT_RESUMED = 1
  private const val EVENT_PAUSED = 2
  private const val LOOKBACK_MS = 6L * 60 * 60 * 1000
  private const val MIN_MS = 1_000L

  @Suppress("DEPRECATION")
  fun hasAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    if (mode == AppOpsManager.MODE_DEFAULT) {
      return context.checkCallingOrSelfPermission(Manifest.permission.PACKAGE_USAGE_STATS) == PackageManager.PERMISSION_GRANTED
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  /** (app label, foreground ms) for today, biggest first. */
  @Suppress("DEPRECATION")
  fun today(context: Context, now: Long): List<Pair<String, Long>> {
    val start = Ui.midnight(now)
    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val events = usm.queryEvents(start - LOOKBACK_MS, now) ?: return emptyList()
    val since = HashMap<String, Long>()
    val totals = HashMap<String, Long>()
    fun add(pkg: String, from: Long, to: Long) {
      val s = maxOf(from, start)
      val e = minOf(to, now)
      if (e > s) totals[pkg] = (totals[pkg] ?: 0L) + (e - s)
    }
    val event = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val pkg = event.packageName ?: continue
      when (event.eventType) {
        EVENT_RESUMED -> if (!since.containsKey(pkg)) since[pkg] = event.timeStamp
        EVENT_PAUSED -> since.remove(pkg)?.let { add(pkg, it, event.timeStamp) }
      }
    }
    for ((pkg, t) in since) add(pkg, t, now)

    val pm = context.packageManager
    val home = pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), PackageManager.MATCH_DEFAULT_ONLY)
      .mapNotNull { it.activityInfo?.packageName }
      .toSet()
    return totals
      .filterKeys { it !in home && it != "com.android.systemui" }
      .filterValues { it >= MIN_MS }
      .map { (pkg, ms) ->
        val label = try {
          pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
        } catch (e: PackageManager.NameNotFoundException) {
          pkg
        }
        Pair(label, ms)
      }
      .sortedByDescending { it.second }
  }
}
