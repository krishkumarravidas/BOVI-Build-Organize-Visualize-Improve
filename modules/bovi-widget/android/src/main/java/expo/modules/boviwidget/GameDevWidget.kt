package expo.modules.boviwidget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

/** Project progress + focus timer (start/stop from the home screen) + a quick-idea button. */
object GameDevWidget {
  fun render(context: Context, manager: AppWidgetManager, id: Int, data: JSONObject?, now: Long): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.bw_gamedev)
    views.setOnClickPendingIntent(R.id.bw_root, Ui.openUrl(context, "bovi://projects"))
    views.setOnClickPendingIntent(R.id.bw_idea, Ui.openUrl(context, "bovi://quick-idea"))

    val projects = Ui.objects(data?.optJSONArray("projects"))
    val project = Schedule.selectedProject(context, data)
    val running = Schedule.runningFocus(data, now)

    // Project header with ‹ › to switch (locked while a session runs on a project).
    val canSwitch = projects.size > 1 && running == null
    views.setViewVisibility(R.id.bw_prev, if (canSwitch) View.VISIBLE else View.INVISIBLE)
    views.setViewVisibility(R.id.bw_next, if (canSwitch) View.VISIBLE else View.INVISIBLE)
    if (canSwitch) {
      views.setOnClickPendingIntent(R.id.bw_prev, Ui.action(context, "project", "dir" to "prev"))
      views.setOnClickPendingIntent(R.id.bw_next, Ui.action(context, "project", "dir" to "next"))
    }

    if (project == null) {
      views.setTextViewText(R.id.bw_project, if (data == null) "Open BOVI to load projects" else "No projects yet")
      views.setViewVisibility(R.id.bw_milestone, View.GONE)
      views.setViewVisibility(R.id.bw_progress, View.GONE)
      views.setViewVisibility(R.id.bw_meta, View.GONE)
    } else {
      val pid = project.optString("id")
      views.setTextViewText(R.id.bw_project, project.optString("name"))
      views.setOnClickPendingIntent(R.id.bw_project, Ui.openUrl(context, "bovi://project/$pid"))
      val next = Ui.str(project, "next")
      views.setTextViewText(R.id.bw_milestone, if (next != null) "Next: $next" else "No milestones yet")
      views.setViewVisibility(R.id.bw_milestone, View.VISIBLE)
      val total = project.optInt("total")
      if (total > 0) {
        views.setProgressBar(R.id.bw_progress, total, project.optInt("done"), false)
        views.setViewVisibility(R.id.bw_progress, View.VISIBLE)
      } else {
        views.setViewVisibility(R.id.bw_progress, View.GONE)
      }
      val meta = ArrayList<String>()
      if (total > 0) meta.add("${project.optInt("done")}/$total milestones")
      Ui.parseDayKey(Ui.str(project, "lastLog"))?.let { meta.add("devlog ${Ui.relativeDays(-Ui.daysFromToday(now, it))}") }
      val focusToday = project.optInt("focusTodayMin")
      if (focusToday > 0) meta.add("${Ui.duration(focusToday * 60_000L)} focus today")
      data?.optJSONObject("weekPlan")?.let { wp ->
        if (wp.optInt("total") > 0) meta.add("week ${wp.optInt("done")}/${wp.optInt("total")}")
      }
      views.setTextViewText(R.id.bw_meta, meta.joinToString(" · "))
      views.setViewVisibility(R.id.bw_meta, if (meta.isEmpty()) View.GONE else View.VISIBLE)
    }

    // Focus timer.
    val focus = data?.optJSONObject("focus")
    if (running != null) {
      views.setViewVisibility(R.id.bw_chrono, View.VISIBLE)
      views.setChronometer(R.id.bw_chrono, SystemClock.elapsedRealtime() + (running.first - now), null, true)
      views.setChronometerCountDown(R.id.bw_chrono, true)
      views.setTextViewText(R.id.bw_focus_status, "left")
      views.setViewVisibility(R.id.bw_minutes, View.GONE)
      views.setTextViewText(R.id.bw_focus_btn, "Stop")
      views.setInt(R.id.bw_focus_btn, "setBackgroundResource", R.drawable.bw_button)
      views.setOnClickPendingIntent(R.id.bw_focus_btn, Ui.action(context, "focusStop"))
    } else {
      views.setChronometer(R.id.bw_chrono, SystemClock.elapsedRealtime(), null, false)
      views.setViewVisibility(R.id.bw_chrono, View.GONE)
      val finished = focus != null && focus.optLong("startedAt") > 0
      views.setTextViewText(
        R.id.bw_focus_status,
        if (finished) "Done ✓ ${focus?.optInt("minutes")} min" else "Focus",
      )
      val minutes = WidgetStore.focusMinutes(context, data?.optInt("focusMinutes", 25) ?: 25)
      views.setViewVisibility(R.id.bw_minutes, View.VISIBLE)
      views.setTextViewText(R.id.bw_minutes, "${minutes}m")
      views.setOnClickPendingIntent(R.id.bw_minutes, Ui.action(context, "minutes"))
      views.setTextViewText(R.id.bw_focus_btn, "Start")
      views.setInt(R.id.bw_focus_btn, "setBackgroundResource", R.drawable.bw_button_primary)
      val pid = project?.optString("id") ?: ""
      views.setOnClickPendingIntent(R.id.bw_focus_btn, Ui.action(context, "focusStart", "projectId" to pid))
    }
    return views
  }
}
