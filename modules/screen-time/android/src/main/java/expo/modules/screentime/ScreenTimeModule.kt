package expo.modules.screentime

import android.Manifest
import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class UsageAccessDeniedException : CodedException("Usage access has not been granted")

class ScreenTimeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ScreenTime")

    Function("hasUsageAccess") {
      hasUsageAccess()
    }

    Function("openUsageAccessSettings") {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    // Foreground time per app within [startMs, endMs). Runs off the JS thread.
    AsyncFunction("getAppUsage") { startMs: Double, endMs: Double ->
      if (!hasUsageAccess()) throw UsageAccessDeniedException()
      computeUsage(startMs.toLong(), endMs.toLong())
    }
  }

  @Suppress("DEPRECATION")
  private fun hasUsageAccess(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    if (mode == AppOpsManager.MODE_DEFAULT) {
      return context.checkCallingOrSelfPermission(Manifest.permission.PACKAGE_USAGE_STATS) ==
        PackageManager.PERMISSION_GRANTED
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  /**
   * Pairs activity-resumed / activity-paused events per package and sums the time each app spent in the
   * foreground, clipped to the requested window. Events are read from a little before the window so an
   * app that was already open at `start` is counted from `start`.
   */
  private fun computeUsage(start: Long, end: Long): List<Map<String, Any>> {
    val until = minOf(end, System.currentTimeMillis())
    if (until <= start) return emptyList()

    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val events = usm.queryEvents(start - LOOKBACK_MS, until) ?: return emptyList()

    val foregroundSince = HashMap<String, Long>()
    val totals = HashMap<String, Long>()
    fun add(pkg: String, from: Long, to: Long) {
      val s = maxOf(from, start)
      val e = minOf(to, until)
      if (e > s) totals[pkg] = (totals[pkg] ?: 0L) + (e - s)
    }

    val event = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val pkg = event.packageName ?: continue
      when (event.eventType) {
        EVENT_RESUMED -> if (!foregroundSince.containsKey(pkg)) foregroundSince[pkg] = event.timeStamp
        EVENT_PAUSED -> foregroundSince.remove(pkg)?.let { add(pkg, it, event.timeStamp) }
      }
    }
    // Apps still in the foreground at the end of the window.
    for ((pkg, since) in foregroundSince) add(pkg, since, until)

    val excluded = launcherPackages() + SYSTEM_UI
    val pm = context.packageManager
    return totals
      .filterKeys { it !in excluded }
      .filterValues { it >= MIN_MS }
      .map { (pkg, ms) -> mapOf("packageName" to pkg, "label" to labelFor(pm, pkg), "foregroundMs" to ms.toDouble()) }
      .sortedByDescending { it["foregroundMs"] as Double }
  }

  /** Home-screen apps; time "on the launcher" isn't app usage. */
  @Suppress("DEPRECATION")
  private fun launcherPackages(): Set<String> {
    val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
    return context.packageManager
      .queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
      .mapNotNull { it.activityInfo?.packageName }
      .toSet()
  }

  @Suppress("DEPRECATION")
  private fun labelFor(pm: PackageManager, pkg: String): String =
    try {
      pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
    } catch (e: PackageManager.NameNotFoundException) {
      pkg
    }

  companion object {
    // Raw values of UsageEvents.Event.ACTIVITY_RESUMED / ACTIVITY_PAUSED (same as the deprecated
    // MOVE_TO_FOREGROUND / MOVE_TO_BACKGROUND on older Android versions).
    private const val EVENT_RESUMED = 1
    private const val EVENT_PAUSED = 2
    private const val LOOKBACK_MS = 6L * 60 * 60 * 1000
    private const val MIN_MS = 1000L
    private const val SYSTEM_UI = "com.android.systemui"
  }
}
