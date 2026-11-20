package expo.modules.boviwidget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.min

/**
 * The calendar's radial dial in miniature: 12 hours on a clock face. Widgets can't follow a spinning
 * finger, so ◀ ▶ turn it 3 hours at a time — through the rest of today and into the next two days —
 * and tapping the label jumps back to now. It drifts back to now by itself after 30 idle minutes.
 */
object DialWidget {
  // Keeps the bitmap (size² × 4 bytes) comfortably under the RemoteViews transaction limit.
  private const val MAX_PX = 380

  fun render(context: Context, manager: AppWidgetManager, id: Int, data: JSONObject?, now: Long): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.bw_dial)
    views.setOnClickPendingIntent(R.id.bw_image, Ui.openUrl(context, "bovi://"))
    views.setOnClickPendingIntent(R.id.bw_dial_prev, Ui.action(context, "dial", "dir" to "prev"))
    views.setOnClickPendingIntent(R.id.bw_dial_next, Ui.action(context, "dial", "dir" to "next"))
    views.setOnClickPendingIntent(R.id.bw_dial_label, Ui.action(context, "dial", "dir" to "now"))

    val offset = WidgetStore.dialOffset(context, now)
    // Turned windows start on the hour, so steps read cleanly (9 AM, 12 PM, 3 PM…).
    val from = if (offset == 0) now else Ui.midnight(now) + ((now - Ui.midnight(now)) / 3_600_000L + offset) * 3_600_000L
    val to = from + 12 * 3_600_000L

    val (wDp, hDp) = Ui.sizeDp(manager, id, 160, 180)
    val density = context.resources.displayMetrics.density
    val px = min(MAX_PX, (min(wDp, hDp - 32) * density).toInt()).coerceAtLeast(120)
    views.setImageViewBitmap(R.id.bw_image, Drawings.dial(context, data, now, max(px, 120), from))

    val label = if (offset == 0) "Next 12 h" else "${Ui.dayPrefix(now, from)}${Ui.time(context, from)} – ${Ui.dayPrefix(now, to).let { if (it == Ui.dayPrefix(now, from)) "" else it }}${Ui.time(context, to)}"
    views.setTextViewText(R.id.bw_dial_label, label)
    views.setTextColor(R.id.bw_dial_label, if (offset == 0) Ui.MUTED else Ui.PRIMARY)
    views.setViewVisibility(R.id.bw_dial_prev, if (offset > WidgetStore.dialMinOffset(now)) View.VISIBLE else View.INVISIBLE)
    views.setViewVisibility(R.id.bw_dial_next, if (offset < WidgetStore.DIAL_MAX_H) View.VISIBLE else View.INVISIBLE)
    return views
  }
}
