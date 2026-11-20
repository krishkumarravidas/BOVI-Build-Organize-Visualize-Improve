package expo.modules.boviwidget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.res.ColorStateList
import android.os.Build
import android.text.SpannableString
import android.text.Spanned
import android.text.style.StrikethroughSpan
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max

/** Schedule helpers over the snapshot (see WidgetData in src/lib/widgetData.ts). */
object Schedule {
  class Now(val current: JSONObject?, val next: JSONObject?)

  fun classes(data: JSONObject?): List<JSONObject> =
    Ui.objects(data?.optJSONArray("classes")).filter { !it.optBoolean("cancelled") }

  fun nowAndNext(data: JSONObject?, now: Long): Now {
    var current: JSONObject? = null
    var next: JSONObject? = null
    for (c in classes(data)) {
      val start = c.optLong("start")
      val end = c.optLong("end")
      if (end <= now) continue
      if (start <= now && current == null) current = c
      else if (start > now) {
        next = c
        break
      }
    }
    return Now(current, next)
  }

  fun nextExam(data: JSONObject?, now: Long): JSONObject? =
    Ui.objects(data?.optJSONArray("exams")).firstOrNull { e ->
      val at = e.optLong("at")
      val days = Ui.daysFromToday(now, at)
      days >= 0 && !(e.optBoolean("timed") && at <= now)
    }

  fun selectedProject(context: Context, data: JSONObject?): JSONObject? {
    val projects = Ui.objects(data?.optJSONArray("projects"))
    val focusProject = Ui.str(data?.optJSONObject("focus"), "projectId")
    val wanted = focusProject ?: WidgetStore.selectedProject(context)
    return projects.firstOrNull { it.optString("id") == wanted } ?: projects.firstOrNull()
  }

  fun projectName(data: JSONObject?, id: String?): String? =
    Ui.objects(data?.optJSONArray("projects")).firstOrNull { it.optString("id") == id }?.optString("name")

  /** Running focus session as (end time, project id), or null (none, or already finished). */
  fun runningFocus(data: JSONObject?, now: Long): Pair<Long, String?>? {
    val f = data?.optJSONObject("focus") ?: return null
    val end = f.optLong("startedAt") + f.optInt("minutes") * 60_000L
    return if (end > now) Pair(end, Ui.str(f, "projectId")) else null
  }

  fun struck(text: String): CharSequence =
    SpannableString(text).apply { setSpan(StrikethroughSpan(), 0, text.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE) }

  fun tintProgress(views: RemoteViews, id: Int, color: Int) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) views.setColorStateList(id, "setProgressTintList", ColorStateList.valueOf(color))
  }

  fun room(c: JSONObject): String = Ui.str(c, "room")?.let { " · $it" } ?: ""
}

/** The original widget: current/next class, next exam, habits — or focus/project in game-dev mode. */
object NextWidget {
  fun render(context: Context, manager: AppWidgetManager, id: Int, data: JSONObject?, now: Long): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.bovi_widget)
    views.setOnClickPendingIntent(R.id.bovi_widget_root, Ui.openUrl(context, "bovi://"))
    if (data == null) return views // keeps the "Open BOVI to load your schedule" placeholder

    var label: String
    var title: String
    var sub = ""
    if (data.optString("mode") == "gamedev") {
      val focus = Schedule.runningFocus(data, now)
      val project = Schedule.selectedProject(context, data)
      if (focus != null) {
        label = "FOCUSING"
        title = Schedule.projectName(data, focus.second) ?: "Focus session"
        sub = "${Ui.duration(focus.first - now + 59_000)} left · ends ${Ui.time(context, focus.first)}"
      } else if (project != null) {
        label = "NEXT UP"
        title = Ui.str(project, "next") ?: project.optString("name")
        sub = project.optString("name").takeIf { it != title } ?: ""
      } else {
        label = (Ui.str(data, "projectsLabel") ?: "Projects").uppercase(java.util.Locale.getDefault())
        title = "No projects yet"
      }
    } else {
      val s = Schedule.nowAndNext(data, now)
      label = "NO MORE CLASSES"
      title = "Nothing scheduled this week"
      val cur = s.current
      val next = s.next
      if (cur != null) {
        label = "NOW"
        title = cur.optString("title")
        sub = "until ${Ui.time(context, cur.optLong("end"))}${Schedule.room(cur)}"
        if (next != null && Ui.daysFromToday(now, next.optLong("start")) == 0) sub += " · next ${next.optString("title")}"
      } else if (next != null) {
        val start = next.optLong("start")
        label = if (Ui.daysFromToday(now, start) == 0) "NEXT" else "NEXT CLASS"
        title = next.optString("title")
        sub = "${Ui.dayPrefix(now, start)}${Ui.time(context, start)}–${Ui.time(context, next.optLong("end"))}${Schedule.room(next)}"
      }
    }
    views.setTextViewText(R.id.bovi_widget_label, label)
    views.setTextViewText(R.id.bovi_widget_title, title)
    views.setTextViewText(R.id.bovi_widget_sub, sub)
    views.setViewVisibility(R.id.bovi_widget_sub, if (sub.isEmpty()) View.GONE else View.VISIBLE)

    var examText = ""
    Schedule.nextExam(data, now)?.let { e ->
      val at = e.optLong("at")
      val whenText = when (val days = Ui.daysFromToday(now, at)) {
        0 -> "Today"
        1 -> "Tomorrow"
        else -> "in $days days"
      }
      examText = "Exam: ${e.optString("title")} · $whenText" + if (e.optBoolean("timed")) " ${Ui.time(context, at)}" else ""
    }
    views.setTextViewText(R.id.bovi_widget_exam, examText)
    views.setViewVisibility(R.id.bovi_widget_exam, if (examText.isEmpty()) View.GONE else View.VISIBLE)

    val habits = WidgetStore.habitsFor(data, Ui.dayKey(now))
    val habitText = if (habits != null && habits.optInt("total") > 0) {
      "Habits ${habits.optInt("done")}/${habits.optInt("total")} done"
    } else {
      ""
    }
    views.setTextViewText(R.id.bovi_widget_habits, habitText)
    views.setViewVisibility(R.id.bovi_widget_habits, if (habitText.isEmpty()) View.GONE else View.VISIBLE)
    return views
  }
}

/** One slim line: "NOW DSA · until 9:30 · 502", or the focus session in game-dev mode. */
object GlanceWidget {
  fun render(context: Context, manager: AppWidgetManager, id: Int, data: JSONObject?, now: Long): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.bw_glance)
    views.setOnClickPendingIntent(R.id.bw_root, Ui.openUrl(context, "bovi://"))
    if (data == null) return views
    var label = "BOVI"
    var text = "All clear"
    var meta = ""
    var color = Ui.PRIMARY
    if (data.optString("mode") == "gamedev") {
      val focus = Schedule.runningFocus(data, now)
      val project = Schedule.selectedProject(context, data)
      if (focus != null) {
        label = "FOCUS"
        color = Ui.ACCENT
        text = Schedule.projectName(data, focus.second) ?: "Focus session"
        meta = "ends ${Ui.time(context, focus.first)}"
      } else if (project != null) {
        label = "NEXT"
        text = Ui.str(project, "next") ?: project.optString("name")
        meta = project.optString("name").takeIf { it != text } ?: ""
      }
    } else {
      val s = Schedule.nowAndNext(data, now)
      val cur = s.current
      val next = s.next
      if (cur != null) {
        label = "NOW"
        color = Ui.ACCENT
        text = cur.optString("title")
        meta = "till ${Ui.time(context, cur.optLong("end"))}${Schedule.room(cur)}"
      } else if (next != null) {
        val start = next.optLong("start")
        label = "NEXT"
        text = next.optString("title")
        meta = "${Ui.dayPrefix(now, start)}${Ui.time(context, start)}${Schedule.room(next)}"
      } else {
        Schedule.nextExam(data, now)?.let { e ->
          label = "EXAM"
          color = Ui.DANGER
          text = e.optString("title")
          meta = when (val d = Ui.daysFromToday(now, e.optLong("at"))) {
            0 -> "today"
            1 -> "tomorrow"
            else -> "in $d days"
          }
        }
      }
    }
    views.setTextViewText(R.id.bw_glance_label, label)
    views.setTextColor(R.id.bw_glance_label, color)
    views.setTextViewText(R.id.bw_glance_text, text)
    views.setTextViewText(R.id.bw_glance_meta, meta)
    views.setViewVisibility(R.id.bw_glance_meta, if (meta.isEmpty()) View.GONE else View.VISIBLE)
    return views
  }
}

/** Today's classes (cancelled struck through, moved ones tagged) and assignments due, with a tick. */
object TodayWidget {
  private const val ROW_DP = 26
  private const val HEADER_DP = 40

  fun render(context: Context, manager: AppWidgetManager, id: Int, data: JSONObject?, now: Long): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.bw_list)
    views.setOnClickPendingIntent(R.id.bw_root, Ui.openUrl(context, "bovi://"))
    views.setTextViewText(R.id.bw_title, "TODAY")
    views.setTextViewText(R.id.bw_header_meta, SimpleDateFormat("EEE d MMM", Locale.getDefault()).format(Date(now)))
    views.removeAllViews(R.id.bw_rows)
    if (data == null) {
      views.setTextViewText(R.id.bw_empty, "Open BOVI to load your schedule")
      views.setViewVisibility(R.id.bw_empty, View.VISIBLE)
      return views
    }
    val (_, h) = Ui.sizeDp(manager, id, 250, 180)
    val capacity = max(2, (h - HEADER_DP) / ROW_DP)

    val todayKey = Ui.dayKey(now)
    val all = Ui.objects(data.optJSONArray("classes"))
    var classes = all.filter { it.optString("date") == todayKey }
    var heading: String? = null
    if (classes.none { !it.optBoolean("cancelled") && it.optLong("end") > now }) {
      // Done for today: show the next day with classes instead.
      val nextDay = all.firstOrNull { it.optString("date") > todayKey && !it.optBoolean("cancelled") }?.optString("date")
      if (nextDay != null) {
        val upcoming = all.filter { it.optString("date") == nextDay && !it.optBoolean("cancelled") }
        val first = upcoming.first().optLong("start")
        heading = if (Ui.daysFromToday(now, first) == 1) "TOMORROW" else
          SimpleDateFormat("EEEE", Locale.getDefault()).format(Date(first)).uppercase(Locale.getDefault())
        classes = upcoming
      }
    }

    val due = Ui.objects(data.optJSONArray("assignments"))
    val dueRows = if (due.isEmpty()) 0 else minOf(due.size, max(1, capacity / 3)) + 1
    var classRoom = capacity - dueRows - (if (heading != null) 1 else 0)
    if (classes.size > classRoom) {
      // Drop finished classes first.
      classes = classes.filter { it.optLong("end") > now }.take(max(classRoom, 1))
    }
    classRoom = max(classRoom, 0)

    if (classes.isEmpty() && due.isEmpty()) {
      views.setTextViewText(R.id.bw_empty, "No classes or deadlines. Enjoy the day!")
      views.setViewVisibility(R.id.bw_empty, View.VISIBLE)
      return views
    }
    views.setViewVisibility(R.id.bw_empty, View.GONE)

    if (heading != null) views.addView(R.id.bw_rows, section(context, heading))
    for (c in classes.take(classRoom)) views.addView(R.id.bw_rows, classRow(context, c, now))

    if (due.isNotEmpty() && dueRows > 0) {
      views.addView(R.id.bw_rows, section(context, "DUE"))
      for (a in due.take(dueRows - 1)) views.addView(R.id.bw_rows, assignmentRow(context, a, now))
    }
    return views
  }

  fun section(context: Context, text: String): RemoteViews =
    RemoteViews(context.packageName, R.layout.bw_section).apply { setTextViewText(R.id.bw_section, text) }

  private fun classRow(context: Context, c: JSONObject, now: Long): RemoteViews {
    val row = RemoteViews(context.packageName, R.layout.bw_row_class)
    val cancelled = c.optBoolean("cancelled")
    val past = c.optLong("end") <= now
    val live = !cancelled && c.optLong("start") <= now && !past
    val title = c.optString("title")
    row.setTextViewText(R.id.bw_row_time, Ui.time(context, c.optLong("start")))
    row.setTextViewText(R.id.bw_row_title, if (cancelled) Schedule.struck(title) else title)
    row.setTextColor(R.id.bw_row_title, if (cancelled || past) Ui.MUTED else Ui.TEXT)
    row.setTextColor(R.id.bw_row_time, if (live) Ui.ACCENT else Ui.MUTED)
    val meta = when {
      cancelled -> "cancelled"
      c.optBoolean("changed") -> "changed" + (Ui.str(c, "room")?.let { " · $it" } ?: "")
      live -> "now"
      else -> Ui.str(c, "room") ?: ""
    }
    row.setTextViewText(R.id.bw_row_meta, meta)
    row.setTextColor(R.id.bw_row_meta, if (c.optBoolean("changed") && !cancelled) Ui.WARN else if (live) Ui.ACCENT else Ui.MUTED)
    row.setInt(R.id.bw_bar, "setBackgroundColor", if (cancelled) Ui.SURFACE else Ui.color(Ui.str(c, "color"), Ui.PRIMARY))
    return row
  }

  private fun assignmentRow(context: Context, a: JSONObject, now: Long): RemoteViews {
    val row = RemoteViews(context.packageName, R.layout.bw_row_check)
    val subject = Ui.str(a, "subject")
    row.setTextViewText(R.id.bw_row_title, a.optString("title") + if (subject != null) " · $subject" else "")
    val dueAt = Ui.parseDayKey(Ui.str(a, "due"))
    val days = if (dueAt != null) Ui.daysFromToday(now, dueAt) else 99
    row.setTextViewText(
      R.id.bw_row_meta,
      when {
        days < 0 -> "overdue"
        days == 0 -> "today"
        days == 1 -> "tomorrow"
        dueAt != null -> SimpleDateFormat("EEE", Locale.getDefault()).format(Date(dueAt))
        else -> ""
      },
    )
    row.setTextColor(R.id.bw_row_meta, if (days <= 0) Ui.DANGER else if (days == 1) Ui.WARN else Ui.MUTED)
    Checks.set(row, false)
    row.setOnClickPendingIntent(R.id.bw_row, Ui.action(context, "assignment", "id" to a.optString("id")))
    return row
  }
}

/** Shared check-circle styling for tappable rows. */
object Checks {
  fun set(row: RemoteViews, done: Boolean) {
    row.setInt(R.id.bw_check, "setBackgroundResource", if (done) R.drawable.bw_check_on else R.drawable.bw_check_off)
    row.setTextViewText(R.id.bw_check, if (done) "✓" else "")
    row.setTextColor(R.id.bw_row_title, if (done) Ui.MUTED else Ui.TEXT)
  }
}

/** "Were you in DSA?" check-in after a class starts, plus a bunk meter per subject. */
object AttendanceWidget {
  private const val ROW_DP = 30

  class Stats(val percent: Int?, val canSkip: Int, val mustAttend: Int)

  /** Mirrors attendanceStats() in src/lib/collegeStats.ts. */
  fun stats(present: Int, total: Int, target: Int): Stats {
    val t = target / 100.0
    val percent = if (total > 0) Math.round(present * 100.0 / total).toInt() else null
    val canSkip = if (total > 0 && present.toDouble() / total >= t && t > 0) floor(present / t - total + 1e-9).toInt() else 0
    val must = if (t >= 1) (if (present < total) Int.MAX_VALUE else 0) else max(0, ceil((t * total - present) / (1 - t) - 1e-9).toInt())
    return Stats(percent, max(0, canSkip), must)
  }

  fun render(context: Context, manager: AppWidgetManager, id: Int, data: JSONObject?, now: Long): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.bw_attendance)
    views.setOnClickPendingIntent(R.id.bw_root, Ui.openUrl(context, "bovi://attendance"))
    views.setTextViewText(R.id.bw_title, "ATTENDANCE")
    views.removeAllViews(R.id.bw_rows)
    if (data == null) {
      views.setViewVisibility(R.id.bw_checkin, View.GONE)
      views.setTextViewText(R.id.bw_empty, "Open BOVI to load your subjects")
      views.setViewVisibility(R.id.bw_empty, View.VISIBLE)
      return views
    }
    val att = data.optJSONObject("attendance")
    val target = att?.optInt("target", 75) ?: 75
    views.setTextViewText(R.id.bw_header_meta, "target $target%")

    // Check-in: today's started classes with a subject and no mark yet; ask about the latest.
    val todayKey = Ui.dayKey(now)
    val unmarked = Ui.objects(data.optJSONArray("classes")).filter {
      it.optString("date") == todayKey && !it.optBoolean("cancelled") && Ui.str(it, "subjectId") != null &&
        it.isNull("mark") && it.optLong("start") <= now
    }
    val ask = unmarked.lastOrNull()
    var used = 40
    if (ask != null) {
      val more = unmarked.size - 1
      views.setViewVisibility(R.id.bw_checkin, View.VISIBLE)
      views.setTextViewText(
        R.id.bw_checkin_text,
        "Were you in ${ask.optString("title")}? (${Ui.time(context, ask.optLong("start"))})" + if (more > 0) "\n+$more more to mark" else "",
      )
      val extras = arrayOf("key" to ask.optString("key"), "date" to ask.optString("date"))
      views.setOnClickPendingIntent(R.id.bw_yes, Ui.action(context, "attend", *extras, "status" to "present"))
      views.setOnClickPendingIntent(R.id.bw_no, Ui.action(context, "attend", *extras, "status" to "absent"))
      used += 56
    } else {
      views.setViewVisibility(R.id.bw_checkin, View.GONE)
    }

    val subjects = Ui.objects(att?.optJSONArray("subjects"))
    if (subjects.isEmpty()) {
      views.setTextViewText(R.id.bw_empty, "Add subjects in BOVI to track attendance")
      views.setViewVisibility(R.id.bw_empty, View.VISIBLE)
      return views
    }
    views.setViewVisibility(R.id.bw_empty, View.GONE)
    val (_, h) = Ui.sizeDp(manager, id, 250, 180)
    val capacity = max(1, (h - used) / ROW_DP)
    // Worst first, so the subjects that need you are always visible; unmarked ones last.
    val sorted = subjects.sortedWith(
      compareBy<JSONObject> { if (it.optInt("total") == 0) 1 else 0 }
        .thenBy { if (it.optInt("total") > 0) it.optInt("present") * 1.0 / it.optInt("total") else 0.0 },
    )
    for (s in sorted.take(capacity)) {
      val st = stats(s.optInt("present"), s.optInt("total"), target)
      val row = RemoteViews(context.packageName, R.layout.bw_row_bar)
      row.setTextViewText(R.id.bw_row_title, s.optString("short"))
      val pct = st.percent
      val (meta, color) = when {
        pct == null -> Pair("not marked yet", Ui.MUTED)
        pct < target -> Pair("$pct% · attend ${if (st.mustAttend == Int.MAX_VALUE) "all" else st.mustAttend.toString()}", Ui.DANGER)
        st.canSkip == 0 -> Pair("$pct% · no skips left", Ui.WARN)
        else -> Pair("$pct% · can skip ${st.canSkip}", Ui.ACCENT)
      }
      row.setTextViewText(R.id.bw_row_meta, meta)
      row.setTextColor(R.id.bw_row_meta, color)
      row.setProgressBar(R.id.bw_row_progress, 100, pct ?: 0, false)
      Schedule.tintProgress(row, R.id.bw_row_progress, if (pct == null) Ui.MUTED else color)
      views.addView(R.id.bw_rows, row)
    }
    return views
  }
}

/** Big countdown to the next exam, with syllabus progress. */
object ExamWidget {
  fun render(context: Context, manager: AppWidgetManager, id: Int, data: JSONObject?, now: Long): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.bw_exam)
    views.setOnClickPendingIntent(R.id.bw_root, Ui.openUrl(context, "bovi://exams"))
    views.setTextViewText(R.id.bw_title, "NEXT EXAM")
    val e = Schedule.nextExam(data, now)
    if (e == null) {
      views.setTextViewText(R.id.bw_exam_days, "—")
      views.setTextColor(R.id.bw_exam_days, Ui.MUTED)
      views.setTextViewText(R.id.bw_exam_unit, "")
      views.setTextViewText(R.id.bw_exam_title, if (data == null) "Open BOVI to load exams" else "No exams coming up")
      views.setViewVisibility(R.id.bw_exam_when, View.GONE)
      views.setViewVisibility(R.id.bw_exam_progress, View.GONE)
      views.setViewVisibility(R.id.bw_exam_topics, View.GONE)
      return views
    }
    val at = e.optLong("at")
    val days = Ui.daysFromToday(now, at)
    val color = when {
      days <= 1 -> Ui.DANGER
      days <= 3 -> Ui.WARN
      else -> Ui.TEXT
    }
    views.setTextViewText(R.id.bw_exam_days, if (days == 0) "Today" else days.toString())
    views.setTextColor(R.id.bw_exam_days, color)
    views.setTextViewText(R.id.bw_exam_unit, if (days == 0) "" else if (days == 1) "day" else "days")
    views.setTextViewText(R.id.bw_exam_title, e.optString("title"))
    val date = SimpleDateFormat("EEE d MMM", Locale.getDefault()).format(Date(at))
    views.setTextViewText(R.id.bw_exam_when, "$date · " + if (e.optBoolean("timed")) Ui.time(context, at) else "time TBA")
    views.setViewVisibility(R.id.bw_exam_when, View.VISIBLE)
    val total = e.optInt("topicsTotal")
    val done = e.optInt("topicsDone")
    if (total > 0) {
      views.setViewVisibility(R.id.bw_exam_progress, View.VISIBLE)
      views.setViewVisibility(R.id.bw_exam_topics, View.VISIBLE)
      views.setProgressBar(R.id.bw_exam_progress, total, done, false)
      Schedule.tintProgress(views, R.id.bw_exam_progress, if (done >= total) Ui.ACCENT else color.takeIf { it != Ui.TEXT } ?: Ui.PRIMARY)
      views.setTextViewText(R.id.bw_exam_topics, if (done >= total) "Syllabus done ✓" else "$done/$total topics revised")
    } else {
      views.setViewVisibility(R.id.bw_exam_progress, View.GONE)
      views.setViewVisibility(R.id.bw_exam_topics, View.GONE)
    }
    return views
  }
}
