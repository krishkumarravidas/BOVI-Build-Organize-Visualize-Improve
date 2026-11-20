package expo.modules.boviwidget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import org.json.JSONObject

/** Handles taps on widget buttons (and the scheduled refresh). Not exported: only our PendingIntents reach it. */
class ActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION) return
    try {
      handle(context, intent)
    } catch (e: Exception) {
      Log.w("BoviWidget", "action failed", e)
    }
    WidgetStore.refreshAll(context)
  }

  private fun handle(context: Context, intent: Intent) {
    val now = System.currentTimeMillis()
    fun extra(key: String): String? = intent.getStringExtra(key)?.takeIf { it.isNotEmpty() }
    when (intent.getStringExtra(EXTRA_OP)) {
      "habit" -> {
        val habitId = extra("habitId") ?: return
        val day = extra("day") ?: return
        WidgetStore.enqueue(
          context,
          JSONObject().put("type", "habit").put("habitId", habitId).put("day", day).put("done", extra("done") == "true"),
        )
      }
      "attend" -> {
        val key = extra("key") ?: return
        val date = extra("date") ?: return
        val status = extra("status")?.takeIf { it == "present" || it == "absent" } ?: return
        WidgetStore.enqueue(context, JSONObject().put("type", "attend").put("key", key).put("date", date).put("status", status))
      }
      "assignment" -> {
        val id = extra("id") ?: return
        WidgetStore.enqueue(context, JSONObject().put("type", "assignment").put("id", id))
      }
      "focusStart" -> {
        val data = WidgetStore.data(context)
        val minutes = WidgetStore.focusMinutes(context, data?.optInt("focusMinutes", 25) ?: 25)
        val action = JSONObject().put("type", "focusStart").put("minutes", minutes).put("at", now)
        extra("projectId")?.let { action.put("projectId", it) }
        WidgetStore.enqueue(context, action)
      }
      "focusStop" -> WidgetStore.enqueue(context, JSONObject().put("type", "focusStop").put("at", now))
      "project" -> {
        val ids = Ui.objects(WidgetStore.data(context)?.optJSONArray("projects")).map { it.optString("id") }
        if (ids.isEmpty()) return
        val current = ids.indexOf(WidgetStore.selectedProject(context)).coerceAtLeast(0)
        val step = if (extra("dir") == "prev") -1 else 1
        WidgetStore.selectProject(context, ids[(current + step + ids.size) % ids.size])
      }
      "dial" -> WidgetStore.turnDial(context, when (extra("dir")) { "prev" -> -1; "next" -> 1; else -> 0 }, now)
      "minutes" -> WidgetStore.cycleFocusMinutes(context, WidgetStore.data(context)?.optInt("focusMinutes", 25) ?: 25)
      "refresh" -> Unit
    }
  }

  companion object {
    const val ACTION = "expo.modules.boviwidget.ACTION"
    const val EXTRA_OP = "op"
  }
}
