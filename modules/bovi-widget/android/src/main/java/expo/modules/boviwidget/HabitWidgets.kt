package expo.modules.boviwidget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.min

/** Today's habits; tap a row to tick it off (or undo) without opening the app. */
object HabitsWidget {
  private const val ROW_DP = 30
  private const val HEADER_DP = 40

  fun render(context: Context, manager: AppWidgetManager, id: Int, data: JSONObject?, now: Long): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.bw_list)
    views.setOnClickPendingIntent(R.id.bw_root, Ui.openUrl(context, "bovi://habits"))
    views.setTextViewText(R.id.bw_title, "HABITS")
    views.removeAllViews(R.id.bw_rows)
    val today = Ui.dayKey(now)
    val habits = WidgetStore.habitsFor(data, today)
    if (habits == null) {
      // Snapshot is from another day: ticks would land on the wrong date, so ask for a refresh.
      views.setTextViewText(R.id.bw_header_meta, "")
      views.setTextViewText(R.id.bw_empty, "Open BOVI to load today's habits")
      views.setViewVisibility(R.id.bw_empty, View.VISIBLE)
      return views
    }
    val items = Ui.objects(habits.optJSONArray("items"))
    val done = items.count { it.optBoolean("done") }
    views.setTextViewText(R.id.bw_header_meta, if (items.isEmpty()) "" else if (done == items.size) "all done ✓" else "$done/${items.size}")
    views.setTextColor(R.id.bw_header_meta, if (items.isNotEmpty() && done == items.size) Ui.ACCENT else Ui.MUTED)
    if (items.isEmpty()) {
      views.setTextViewText(R.id.bw_empty, "No habits today. Add some in BOVI.")
      views.setViewVisibility(R.id.bw_empty, View.VISIBLE)
      return views
    }
    views.setViewVisibility(R.id.bw_empty, View.GONE)
    val (_, h) = Ui.sizeDp(manager, id, 180, 180)
    val capacity = max(1, (h - HEADER_DP) / ROW_DP)
    // Undone first when space is short, so what's left is always visible.
    val shown = if (items.size > capacity) items.sortedBy { if (it.optBoolean("done")) 1 else 0 }.take(capacity) else items
    for (habit in shown) {
      val row = RemoteViews(context.packageName, R.layout.bw_row_check)
      val isDone = habit.optBoolean("done")
      row.setTextViewText(R.id.bw_row_title, habit.optString("name"))
      Checks.set(row, isDone)
      row.setTextViewText(R.id.bw_row_meta, Ui.str(habit, "time")?.let { formatHm(context, it) } ?: "")
      row.setTextColor(R.id.bw_row_meta, Ui.MUTED)
      row.setOnClickPendingIntent(
        R.id.bw_row,
        Ui.action(context, "habit", "habitId" to habit.optString("id"), "day" to today, "done" to (!isDone).toString()),
      )
      views.addView(R.id.bw_rows, row)
    }
    if (items.size > shown.size) {
      views.addView(R.id.bw_rows, TodayWidget.section(context, "+${items.size - shown.size} more"))
    }
    return views
  }

  private fun formatHm(context: Context, hm: String): String {
    val parts = hm.split(":")
    val h = parts.getOrNull(0)?.toIntOrNull() ?: return hm
    val m = parts.getOrNull(1)?.toIntOrNull() ?: 0
    val cal = java.util.Calendar.getInstance().apply {
      set(java.util.Calendar.HOUR_OF_DAY, h)
      set(java.util.Calendar.MINUTE, m)
    }
    return Ui.time(context, cal.timeInMillis)
  }
}

/** This week's progress rings (habits, revision, assignments per day), like the calendar screen. */
object WeekWidget {
  fun render(context: Context, manager: AppWidgetManager, id: Int, data: JSONObject?, now: Long): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.bw_image)
    views.setOnClickPendingIntent(R.id.bw_root, Ui.openUrl(context, "bovi://"))
    val week = Ui.objects(data?.optJSONArray("week"))
    if (week.isEmpty()) {
      views.setViewVisibility(R.id.bw_image, View.GONE)
      views.setTextViewText(R.id.bw_image_hint, "Open BOVI to load your week")
      views.setViewVisibility(R.id.bw_image_hint, View.VISIBLE)
      return views
    }
    val (wDp, hDp) = Ui.sizeDp(manager, id, 300, 80)
    val density = context.resources.displayMetrics.density
    // Keep the bitmap well under the RemoteViews size limit.
    val scale = min(density, 640f / max(wDp, 1))
    val bitmap = Drawings.week(week, Ui.dayKey(now), (wDp * scale).toInt().coerceAtLeast(200), (hDp * scale).toInt().coerceIn(60, 240), scale)
    views.setImageViewBitmap(R.id.bw_image, bitmap)
    views.setViewVisibility(R.id.bw_image, View.VISIBLE)
    views.setViewVisibility(R.id.bw_image_hint, View.GONE)
    return views
  }
}
