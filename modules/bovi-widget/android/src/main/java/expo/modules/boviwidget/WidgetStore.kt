package expo.modules.boviwidget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject

/**
 * Native side of the widgets: the app's JSON snapshot, a queue of actions taken on widgets (replayed by the
 * app the next time it runs), widget-only preferences, and redrawing every placed widget.
 *
 * Actions are applied to the stored snapshot straight away ("optimistic"), so a tick shows instantly even
 * though the app's own data only changes when it drains the queue.
 */
object WidgetStore {
  private const val PREFS = "bovi_widget"
  private const val KEY_DATA = "data"
  private const val KEY_ACTIONS = "actions"
  private const val KEY_PROJECT = "project"
  private const val KEY_MINUTES = "focus_minutes"
  private const val KEY_DIAL_OFFSET = "dial_offset_h"
  private const val KEY_DIAL_AT = "dial_offset_at"

  /** Dial widget: hours per ◀ ▶ tap, how far it can turn, and when it drifts back to "now". */
  const val DIAL_STEP_H = 3
  const val DIAL_MAX_H = 48
  private const val DIAL_RESET_MS = 30 * 60_000L
  private const val TAG = "BoviWidget"

  val FOCUS_PLANS = intArrayOf(25, 45, 60)

  /** Set by the module while the app runs, so it can drain the queue immediately. */
  @Volatile
  var listener: (() -> Unit)? = null

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun data(context: Context): JSONObject? =
    try {
      prefs(context).getString(KEY_DATA, null)?.let { JSONObject(it) }
    } catch (e: Exception) {
      null
    }

  /** New snapshot from the app; actions it hasn't drained yet are re-applied on top. */
  @Synchronized
  fun setData(context: Context, json: String) {
    val data = try {
      JSONObject(json)
    } catch (e: Exception) {
      return
    }
    for (a in Ui.objects(pending(context))) applyOptimistic(data, a)
    prefs(context).edit().putString(KEY_DATA, data.toString()).apply()
    refreshAll(context)
  }

  private fun pending(context: Context): JSONArray =
    try {
      JSONArray(prefs(context).getString(KEY_ACTIONS, "[]"))
    } catch (e: Exception) {
      JSONArray()
    }

  @Synchronized
  fun takeActions(context: Context): String {
    val p = prefs(context)
    val raw = p.getString(KEY_ACTIONS, "[]") ?: "[]"
    p.edit().putString(KEY_ACTIONS, "[]").commit()
    return raw
  }

  @Synchronized
  fun enqueue(context: Context, action: JSONObject) {
    val queue = pending(context)
    queue.put(action)
    val editor = prefs(context).edit().putString(KEY_ACTIONS, queue.toString())
    data(context)?.let {
      applyOptimistic(it, action)
      editor.putString(KEY_DATA, it.toString())
    }
    editor.commit()
    try {
      listener?.invoke()
    } catch (e: Exception) {
      Log.w(TAG, "listener failed", e)
    }
  }

  // ---------- widget-only preferences ----------

  fun selectedProject(context: Context): String? = prefs(context).getString(KEY_PROJECT, null)

  fun selectProject(context: Context, id: String?) {
    prefs(context).edit().putString(KEY_PROJECT, id).apply()
  }

  fun focusMinutes(context: Context, fallback: Int): Int = prefs(context).getInt(KEY_MINUTES, fallback)

  fun cycleFocusMinutes(context: Context, fallback: Int) {
    val current = focusMinutes(context, fallback)
    val i = FOCUS_PLANS.indexOf(current)
    val next = FOCUS_PLANS[if (i < 0) 0 else (i + 1) % FOCUS_PLANS.size]
    prefs(context).edit().putInt(KEY_MINUTES, next).apply()
  }

  /** Hours the dial widget is turned away from now (0 after 30 idle minutes). */
  fun dialOffset(context: Context, now: Long): Int {
    val p = prefs(context)
    if (now - p.getLong(KEY_DIAL_AT, 0L) > DIAL_RESET_MS) return 0
    return p.getInt(KEY_DIAL_OFFSET, 0)
  }

  /** Earliest offset: the snapshot starts at today's midnight. */
  fun dialMinOffset(now: Long): Int = -((now - Ui.midnight(now)) / 3_600_000L).toInt()

  fun turnDial(context: Context, steps: Int, now: Long) {
    val next = if (steps == 0) 0 else (dialOffset(context, now) + steps * DIAL_STEP_H).coerceIn(dialMinOffset(now), DIAL_MAX_H)
    prefs(context).edit().putInt(KEY_DIAL_OFFSET, next).putLong(KEY_DIAL_AT, now).apply()
  }

  // ---------- optimistic updates (mirror src/lib/widgetActions.ts) ----------

  fun applyOptimistic(data: JSONObject, a: JSONObject) {
    try {
      when (a.optString("type")) {
        "habit" -> applyHabit(data, a)
        "attend" -> applyAttend(data, a)
        "assignment" -> {
          val id = a.optString("id")
          val kept = JSONArray()
          for (x in Ui.objects(data.optJSONArray("assignments"))) if (x.optString("id") != id) kept.put(x)
          data.put("assignments", kept)
        }
        "focusStart" -> {
          val f = JSONObject().put("startedAt", a.optLong("at")).put("minutes", a.optInt("minutes", 25))
          Ui.str(a, "projectId")?.let { f.put("projectId", it) }
          data.put("focus", f)
        }
        "focusStop" -> data.put("focus", JSONObject.NULL)
      }
    } catch (e: Exception) {
      Log.w(TAG, "optimistic update failed", e)
    }
  }

  /** Today's habits from the snapshot — or tomorrow's list once the snapshot's day has passed. */
  fun habitsFor(data: JSONObject?, day: String): JSONObject? =
    listOf("habits", "habitsNext").mapNotNull { data?.optJSONObject(it) }.firstOrNull { it.optString("day") == day }

  private fun applyHabit(data: JSONObject, a: JSONObject) {
    val day = a.optString("day")
    val habits = habitsFor(data, day) ?: return
    val target = a.optBoolean("done")
    var delta = 0
    var done = 0
    for (h in Ui.objects(habits.optJSONArray("items"))) {
      if (h.optString("id") == a.optString("habitId")) {
        val was = h.optBoolean("done")
        if (was != target) delta = if (target) 1 else -1
        h.put("done", target)
      }
      if (h.optBoolean("done")) done++
    }
    habits.put("done", done)
    if (delta != 0) {
      for (w in Ui.objects(data.optJSONArray("week"))) {
        if (w.optString("day") == day) w.put("done", (w.optInt("done") + delta).coerceIn(0, w.optInt("total")))
      }
    }
  }

  private fun applyAttend(data: JSONObject, a: JSONObject) {
    val status = a.optString("status")
    for (c in Ui.objects(data.optJSONArray("classes"))) {
      if (c.optString("date") != a.optString("date") || c.optString("key") != a.optString("key")) continue
      if (!c.isNull("mark")) return // already marked (in the app or by an earlier tap)
      c.put("mark", status)
      val subjectId = Ui.str(c, "subjectId") ?: return
      val att = data.optJSONObject("attendance") ?: return
      for (s in Ui.objects(att.optJSONArray("subjects"))) {
        if (s.optString("id") != subjectId) continue
        s.put("total", s.optInt("total") + 1)
        if (status == "present") s.put("present", s.optInt("present") + 1)
      }
      return
    }
  }

  // ---------- redraw ----------

  fun refreshAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    val data = data(context)
    val now = System.currentTimeMillis()
    var placed = 0
    for (kind in WidgetKinds.ALL) {
      val ids = try {
        manager.getAppWidgetIds(ComponentName(context, kind.provider))
      } catch (e: Exception) {
        IntArray(0)
      }
      placed += ids.size
      for (id in ids) update(context, manager, kind, id, data, now)
    }
    if (placed > 0) scheduleNextRefresh(context, data, now)
  }

  fun refresh(context: Context, kind: WidgetKind, ids: IntArray) {
    val manager = AppWidgetManager.getInstance(context)
    val data = data(context)
    val now = System.currentTimeMillis()
    for (id in ids) update(context, manager, kind, id, data, now)
    scheduleNextRefresh(context, data, now)
  }

  private fun update(context: Context, manager: AppWidgetManager, kind: WidgetKind, id: Int, data: JSONObject?, now: Long) {
    val views = try {
      kind.render(context, manager, id, data, now)
    } catch (e: Exception) {
      Log.w(TAG, "render ${kind.key} failed", e)
      RemoteViews(context.packageName, R.layout.bw_message).apply {
        setTextViewText(R.id.bw_message_text, "Open BOVI to refresh")
        Ui.openUrl(context, "bovi://").let { setOnClickPendingIntent(R.id.bw_root, it) }
      }
    }
    try {
      manager.updateAppWidget(id, views)
    } catch (e: Exception) {
      Log.w(TAG, "update ${kind.key} failed", e)
    }
  }

  /**
   * Redraws at the next moment something changes (a class starts or ends, a focus session finishes,
   * midnight), on top of the system's 30-minute refresh. Inexact, so it needs no special permission.
   */
  private fun scheduleNextRefresh(context: Context, data: JSONObject?, now: Long) {
    var next = Ui.midnight(now) + 86_400_000L + 60_000L
    for (c in Ui.objects(data?.optJSONArray("classes"))) {
      for (t in longArrayOf(c.optLong("start"), c.optLong("end"))) if (t > now && t < next) next = t
    }
    data?.optJSONObject("focus")?.let { f ->
      val end = f.optLong("startedAt") + f.optInt("minutes") * 60_000L
      if (end > now && end < next) next = end
    }
    try {
      val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val intent = Intent(context, ActionReceiver::class.java)
        .setAction(ActionReceiver.ACTION)
        .putExtra(ActionReceiver.EXTRA_OP, "refresh")
      val pi = PendingIntent.getBroadcast(context, 7001, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      am.set(AlarmManager.RTC, next + 1_000L, pi)
    } catch (e: Exception) {
      Log.w(TAG, "could not schedule refresh", e)
    }
  }
}
