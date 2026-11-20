package expo.modules.boviwidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BoviWidgetModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BoviWidget")

    // Fired when a widget queues an action while the app is running, so JS can drain it right away.
    Events("onAction")

    OnCreate {
      WidgetStore.listener = { sendEvent("onAction", mapOf<String, Any?>()) }
    }

    OnDestroy {
      WidgetStore.listener = null
    }

    // Stores the JSON snapshot and redraws any placed widgets (off the JS thread: drawing takes a moment).
    AsyncFunction("setWidgetData") { json: String ->
      WidgetStore.setData(context, json)
    }

    // Returns the queued widget actions (JSON array) and clears the queue.
    Function("takeActions") {
      WidgetStore.takeActions(context)
    }

    Function("canPinWidgets") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && AppWidgetManager.getInstance(context).isRequestPinAppWidgetSupported
    }

    // Asks the launcher to add a widget of the given kind to the home screen.
    Function("pinWidget") { key: String ->
      val kind = WidgetKinds.byKey(key)
      val manager = AppWidgetManager.getInstance(context)
      if (kind == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !manager.isRequestPinAppWidgetSupported) {
        false
      } else {
        manager.requestPinAppWidget(ComponentName(context, kind.provider), null, null)
      }
    }

    // How many of each kind are on the home screen.
    Function("placedWidgets") {
      val manager = AppWidgetManager.getInstance(context)
      WidgetKinds.ALL.associate { it.key to manager.getAppWidgetIds(ComponentName(context, it.provider)).size }
    }
  }
}
