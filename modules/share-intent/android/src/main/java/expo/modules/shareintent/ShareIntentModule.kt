package expo.modules.shareintent

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import android.webkit.MimeTypeMap
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Receives ACTION_SEND / ACTION_SEND_MULTIPLE (text, links, images) shared to BOVI from other apps.
 * The share sheet entry itself comes from intent filters added by plugins/withShareIntent.js.
 *
 * JS calls `takeShared()` on start and whenever "onShare" fires; each share is returned once.
 * Shared images are copied into the app's files so they outlive the sender's temporary permission.
 */
class ShareIntentModule : Module() {
  private var pending: Intent? = null

  override fun definition() = ModuleDefinition {
    Name("ShareIntent")

    Events("onShare")

    OnNewIntent { intent ->
      if (isShare(intent)) {
        pending = intent
        sendEvent("onShare", mapOf<String, Any?>())
      }
    }

    AsyncFunction("takeShared") {
      val activity = appContext.currentActivity
      val intent = pending ?: activity?.intent?.takeIf { isShare(it) }
      pending = null
      if (intent == null) return@AsyncFunction null
      // Consume it, so reopening the app doesn't replay the same share.
      if (activity != null && activity.intent === intent) activity.intent = Intent(Intent.ACTION_MAIN)
      val context = appContext.reactContext ?: return@AsyncFunction null
      read(context, intent)
    }
  }

  private fun isShare(intent: Intent?): Boolean =
    intent != null && (intent.action == Intent.ACTION_SEND || intent.action == Intent.ACTION_SEND_MULTIPLE)

  private fun read(context: Context, intent: Intent): Map<String, Any?> {
    val type = intent.type ?: ""
    val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
    val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
    val images = ArrayList<String>()
    if (type.startsWith("image/")) {
      for ((i, uri) in streams(intent).take(MAX_IMAGES).withIndex()) copy(context, uri, i)?.let { images.add(it) }
    }
    return mapOf("text" to text, "subject" to subject, "images" to images, "mimeType" to type)
  }

  @Suppress("DEPRECATION")
  private fun streams(intent: Intent): List<Uri> {
    if (intent.action == Intent.ACTION_SEND_MULTIPLE) {
      val list = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
      } else {
        intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
      }
      return list?.filterNotNull() ?: emptyList()
    }
    val one = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
      intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
    }
    return listOfNotNull(one)
  }

  /** Copies a shared content:// image into files/shared and returns its file:// URI. */
  private fun copy(context: Context, uri: Uri, index: Int): String? {
    return try {
      val dir = File(context.filesDir, "shared").apply { mkdirs() }
      val ext = context.contentResolver.getType(uri)?.let { MimeTypeMap.getSingleton().getExtensionFromMimeType(it) } ?: "jpg"
      val file = File(dir, "share-${System.currentTimeMillis()}-$index.$ext")
      val input = context.contentResolver.openInputStream(uri) ?: return null
      input.use { src -> file.outputStream().use { src.copyTo(it) } }
      Uri.fromFile(file).toString()
    } catch (e: Exception) {
      Log.w("ShareIntent", "could not copy shared image", e)
      null
    }
  }

  companion object {
    private const val MAX_IMAGES = 10
  }
}
