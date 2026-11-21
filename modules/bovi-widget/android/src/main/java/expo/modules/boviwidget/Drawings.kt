package expo.modules.boviwidget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import org.json.JSONObject
import java.util.Calendar
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/** Bitmaps for widgets that need real drawing (RemoteViews can't host custom views). */
object Drawings {
  // Ring bands as fractions of the dial radius — same layout as the app's RadialDay.
  private val LIFE = floatArrayOf(0.47f, 0.605f)
  private val COLLEGE = floatArrayOf(0.625f, 0.79f)
  private val EVENTS = floatArrayOf(0.81f, 0.935f)
  private const val FACE = 0.44f
  private const val HOUR_MS = 3_600_000L

  private fun band(ring: String): FloatArray = when (ring) {
    "college" -> COLLEGE
    "events" -> EVENTS
    else -> LIFE
  }

  /** Canvas angle (0° = 3 o'clock, clockwise) of a time on a 12-hour clock face. */
  private fun clockAngle(ms: Long): Float {
    val cal = Calendar.getInstance().apply { timeInMillis = ms }
    val hours = (cal.get(Calendar.HOUR_OF_DAY) % 12) + cal.get(Calendar.MINUTE) / 60f
    return hours * 30f - 90f
  }

  private fun readableOn(color: Int): Int {
    val l = (0.299 * Color.red(color) + 0.587 * Color.green(color) + 0.114 * Color.blue(color)) / 255
    return if (l > 0.6) 0xFF111111.toInt() else Color.WHITE
  }

  private fun paint(color: Int, style: Paint.Style = Paint.Style.FILL): Paint =
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
      this.color = color
      this.style = style
    }

  /**
   * A 12-hour clock face showing 12 hours from `from` (normally now; the widget's ◀ ▶ move it, also
   * across days): arcs sit where they'd be on a wall clock, in three rings (life / college / events),
   * with the time hand (when now is in view) and what's on now / next / first in the middle.
   */
  fun dial(context: Context, data: JSONObject?, now: Long, size: Int, from: Long = now): Bitmap {
    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val c = size / 2f
    val r = size / 2f - size * 0.01f
    val until = from + 12 * HOUR_MS - 60_000L
    val nowInView = now in from..until

    // Tracks.
    for (b in arrayOf(LIFE, COLLEGE, EVENTS)) {
      val p = paint(Ui.SURFACE, Paint.Style.STROKE).apply { strokeWidth = (b[1] - b[0]) * r }
      canvas.drawCircle(c, c, (b[0] + b[1]) / 2 * r, p)
    }

    val items = Ui.objects(data?.optJSONArray("dial"))
    val label = paint(Color.WHITE).apply {
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      textAlign = Paint.Align.CENTER
    }
    for (item in items) {
      if (item.optBoolean("point")) continue
      val s = maxOf(item.optLong("start"), from)
      val e = minOf(item.optLong("end"), until)
      if (e <= s) continue
      val past = item.optLong("end") <= now
      val b = band(item.optString("ring"))
      val radius = (b[0] + b[1]) / 2 * r
      val width = (b[1] - b[0]) * r
      val color = Ui.color(Ui.str(item, "color"), Ui.PRIMARY)
      val start = clockAngle(s)
      val sweep = maxOf(2f, (e - s).toFloat() / HOUR_MS * 30f)
      val oval = RectF(c - radius, c - radius, c + radius, c + radius)
      val arc = paint(color, Paint.Style.STROKE).apply {
        strokeWidth = width * 0.86f
        alpha = if (item.optBoolean("done") || past) 110 else 255
      }
      canvas.drawArc(oval, start, sweep, false, arc)

      // Label along the arc when it fits, flipped on the lower half so it's never upside down.
      val title = item.optString("title")
      label.textSize = width * 0.46f
      label.color = readableOn(color)
      val arcLen = (sweep / 360f * 2 * PI * radius).toFloat()
      var text = title
      while (text.length > 1 && label.measureText(text) > arcLen - width * 0.5f) text = text.dropLast(1)
      if (text.length >= 2 || text == title) {
        if (text != title && text.length >= 3) text = text.dropLast(1) + "…"
        val mid = ((start + sweep / 2) % 360 + 360) % 360
        val path = Path()
        if (mid > 0 && mid < 180) path.arcTo(oval, start + sweep, -sweep, true) else path.arcTo(oval, start, sweep, true)
        canvas.drawTextOnPath(text, path, 0f, label.textSize * 0.35f, label)
      }
    }

    // Habit points on the life ring.
    for (item in items) {
      if (!item.optBoolean("point")) continue
      val t = item.optLong("start")
      if (t < from || t > until) continue
      val a = clockAngle(t) * PI.toFloat() / 180f
      val radius = (LIFE[0] + LIFE[1]) / 2 * r
      val x = c + radius * cos(a)
      val y = c + radius * sin(a)
      val dot = (LIFE[1] - LIFE[0]) * r * 0.32f
      canvas.drawCircle(x, y, dot, paint(if (item.optBoolean("done")) Ui.ACCENT else Ui.FACE))
      canvas.drawCircle(x, y, dot, paint(Ui.ACCENT, Paint.Style.STROKE).apply { strokeWidth = dot * 0.35f })
    }

    // Face: ticks and hour numbers.
    val faceR = FACE * r
    canvas.drawCircle(c, c, faceR, paint(Ui.FACE))
    val tick = paint(Ui.MUTED, Paint.Style.STROKE).apply { strokeWidth = size * 0.006f }
    val num = paint(Ui.TEXT).apply {
      textAlign = Paint.Align.CENTER
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    for (h in 0 until 12) {
      val a = (h * 30f - 90f) * PI.toFloat() / 180f
      val major = h % 3 == 0
      val r0 = faceR * (if (major) 0.84f else 0.9f)
      canvas.drawLine(c + r0 * cos(a), c + r0 * sin(a), c + faceR * 0.97f * cos(a), c + faceR * 0.97f * sin(a), tick)
      if (major) {
        num.textSize = size * 0.06f
        val nr = faceR * 0.68f
        val n = if (h == 0) "12" else h.toString()
        canvas.drawText(n, c + nr * cos(a), c + nr * sin(a) + num.textSize * 0.36f, num)
      }
    }

    // Now hand.
    val na = clockAngle(now) * PI.toFloat() / 180f
    val hand = paint(Ui.DANGER, Paint.Style.STROKE).apply {
      strokeWidth = size * 0.012f
      strokeCap = Paint.Cap.ROUND
    }
    if (nowInView) canvas.drawLine(c + faceR * 0.42f * cos(na), c + faceR * 0.42f * sin(na), c + r * 0.99f * cos(na), c + r * 0.99f * sin(na), hand)

    // Centre: what's on now / next — or, when turned away from now, the first thing in view.
    val after = if (nowInView) now else from
    val current = items.firstOrNull { !it.optBoolean("point") && it.optLong("end") > after && it.optLong("start") <= until }
    val text = paint(Ui.TEXT).apply { textAlign = Paint.Align.CENTER }
    if (current != null) {
      val live = nowInView && current.optLong("start") <= now
      text.textSize = size * 0.035f
      text.color = if (live) Ui.ACCENT else Ui.PRIMARY
      text.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      text.letterSpacing = 0.1f
      val head = when {
        live -> "NOW"
        nowInView -> "NEXT"
        else -> Ui.dayPrefix(now, current.optLong("start")).trim().ifEmpty { "TODAY" }.uppercase()
      }
      canvas.drawText(head, c, c - size * 0.035f, text)
      text.letterSpacing = 0f
      text.color = Ui.TEXT
      text.textSize = size * 0.05f
      var title = current.optString("title")
      val maxW = faceR * 0.95f
      while (title.length > 2 && text.measureText(title) > maxW) title = title.dropLast(2) + "…"
      canvas.drawText(title, c, c + size * 0.022f, text)
      text.typeface = Typeface.DEFAULT
      text.color = Ui.MUTED
      text.textSize = size * 0.036f
      val t = if (live) "till ${Ui.time(context, current.optLong("end"))}" else Ui.time(context, current.optLong("start"))
      canvas.drawText(t, c, c + size * 0.07f, text)
    } else {
      text.textSize = size * 0.04f
      text.color = Ui.MUTED
      canvas.drawText(if (data == null) "Open BOVI" else if (nowInView) "All clear" else "Nothing here", c, c + text.textSize * 0.35f, text)
    }
    return bmp
  }

  /** Seven progress rings (Mon–Sun) with day letters; today is highlighted. */
  fun week(week: List<JSONObject>, today: String, w: Int, h: Int, scale: Float): Bitmap {
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val cellW = w / 7f
    val stroke = 3.5f * scale
    val radius = min(cellW * 0.4f, h * 0.32f)
    val cy = h * 0.42f
    val letters = arrayOf("M", "T", "W", "T", "F", "S", "S")
    val text = paint(Ui.TEXT).apply {
      textAlign = Paint.Align.CENTER
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    for ((i, d) in week.take(7).withIndex()) {
      val cx = cellW * (i + 0.5f)
      val isToday = d.optString("day") == today
      if (isToday) canvas.drawCircle(cx, cy, radius + stroke, paint(Ui.SURFACE))
      canvas.drawCircle(cx, cy, radius, paint(0xFF2A2A2A.toInt(), Paint.Style.STROKE).apply { strokeWidth = stroke })
      val total = d.optInt("total")
      val pct = if (total > 0) d.optInt("done") * 100 / total else -1
      if (pct > 0) {
        val color = when {
          pct >= 80 -> Ui.ACCENT
          pct >= 40 -> Ui.PRIMARY
          else -> Ui.DANGER
        }
        val oval = RectF(cx - radius, cy - radius, cx + radius, cy + radius)
        canvas.drawArc(oval, -90f, 360f * pct / 100f, false, paint(color, Paint.Style.STROKE).apply {
          strokeWidth = stroke
          strokeCap = Paint.Cap.ROUND
        })
      }
      text.textSize = radius * 0.8f
      text.color = if (isToday) Ui.TEXT else Ui.MUTED
      canvas.drawText(letters[i], cx, cy + text.textSize * 0.36f, text)
      text.textSize = min(radius * 0.62f, h * 0.15f)
      text.color = if (pct >= 0) Ui.MUTED else 0x669B9B9B
      canvas.drawText(if (pct >= 0) "$pct%" else "–", cx, h * 0.93f, text)
    }
    return bmp
  }
}
