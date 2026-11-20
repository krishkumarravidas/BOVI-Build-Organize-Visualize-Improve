package expo.modules.boviwidget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.os.Bundle
import android.widget.RemoteViews
import org.json.JSONObject

typealias Renderer = (context: Context, manager: AppWidgetManager, id: Int, data: JSONObject?, now: Long) -> RemoteViews

/** One kind of home-screen widget: its key (shared with JS), provider class and renderer. */
class WidgetKind(val key: String, val provider: Class<out AppWidgetProvider>, val render: Renderer)

object WidgetKinds {
  val NEXT = WidgetKind("next", BoviWidgetProvider::class.java, NextWidget::render)
  val GLANCE = WidgetKind("glance", GlanceWidgetProvider::class.java, GlanceWidget::render)
  val TODAY = WidgetKind("today", TodayWidgetProvider::class.java, TodayWidget::render)
  val HABITS = WidgetKind("habits", HabitsWidgetProvider::class.java, HabitsWidget::render)
  val ATTENDANCE = WidgetKind("attendance", AttendanceWidgetProvider::class.java, AttendanceWidget::render)
  val EXAM = WidgetKind("exam", ExamWidgetProvider::class.java, ExamWidget::render)
  val GAMEDEV = WidgetKind("gamedev", GameDevWidgetProvider::class.java, GameDevWidget::render)
  val DIAL = WidgetKind("dial", DialWidgetProvider::class.java, DialWidget::render)
  val WEEK = WidgetKind("week", WeekWidgetProvider::class.java, WeekWidget::render)
  val SCREEN_TIME = WidgetKind("screentime", ScreenTimeWidgetProvider::class.java, ScreenTimeWidget::render)

  val ALL = listOf(NEXT, GLANCE, TODAY, HABITS, ATTENDANCE, EXAM, GAMEDEV, DIAL, WEEK, SCREEN_TIME)

  fun byKey(key: String): WidgetKind? = ALL.firstOrNull { it.key == key }
}

/** Every provider redraws through [WidgetStore], so all kinds share data, actions and error handling. */
abstract class BaseWidgetProvider : AppWidgetProvider() {
  abstract val kind: WidgetKind

  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    WidgetStore.refresh(context, kind, appWidgetIds)
  }

  override fun onAppWidgetOptionsChanged(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int, newOptions: Bundle?) {
    WidgetStore.refresh(context, kind, intArrayOf(appWidgetId))
  }
}

// The original widget keeps its class name so widgets already on the home screen survive the update.
class BoviWidgetProvider : BaseWidgetProvider() {
  override val kind: WidgetKind get() = WidgetKinds.NEXT
}

class GlanceWidgetProvider : BaseWidgetProvider() {
  override val kind: WidgetKind get() = WidgetKinds.GLANCE
}

class TodayWidgetProvider : BaseWidgetProvider() {
  override val kind: WidgetKind get() = WidgetKinds.TODAY
}

class HabitsWidgetProvider : BaseWidgetProvider() {
  override val kind: WidgetKind get() = WidgetKinds.HABITS
}

class AttendanceWidgetProvider : BaseWidgetProvider() {
  override val kind: WidgetKind get() = WidgetKinds.ATTENDANCE
}

class ExamWidgetProvider : BaseWidgetProvider() {
  override val kind: WidgetKind get() = WidgetKinds.EXAM
}

class GameDevWidgetProvider : BaseWidgetProvider() {
  override val kind: WidgetKind get() = WidgetKinds.GAMEDEV
}

class DialWidgetProvider : BaseWidgetProvider() {
  override val kind: WidgetKind get() = WidgetKinds.DIAL
}

class WeekWidgetProvider : BaseWidgetProvider() {
  override val kind: WidgetKind get() = WidgetKinds.WEEK
}

class ScreenTimeWidgetProvider : BaseWidgetProvider() {
  override val kind: WidgetKind get() = WidgetKinds.SCREEN_TIME
}
