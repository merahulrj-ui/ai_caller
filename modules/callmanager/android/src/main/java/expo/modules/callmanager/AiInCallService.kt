package expo.modules.callmanager

import android.telecom.Call
import android.telecom.InCallService
import android.telecom.VideoProfile
import android.content.Context
import android.content.Intent
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class AiInCallService : InCallService() {

  companion object {
    var instance: AiInCallService? = null
    var activeCall: Call? = null
    var isAiEnabled: Boolean = true

    fun logDebug(context: Context, message: String) {
      try {
        val prefs = context.getSharedPreferences("callmanager_debug", Context.MODE_PRIVATE)
        val timeStamp = SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(Date())
        val existingLogs = prefs.getString("logs", "") ?: ""
        val newLogs = "[$timeStamp] [InCallService] $message\n$existingLogs"
        val lines = newLogs.split("\n").take(50).joinToString("\n")
        prefs.edit().putString("logs", lines).apply()
      } catch (e: Throwable) {
        e.printStackTrace()
      }
    }
  }

  override fun onCreate() {
    super.onCreate()
    instance = this
  }

  override fun onDestroy() {
    super.onDestroy()
    if (instance == this) instance = null
  }

  private fun bringAppToForeground() {
    try {
      android.os.Handler(android.os.Looper.getMainLooper()).post {
        try {
          val mainIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
          }
          if (mainIntent != null) {
            startActivity(mainIntent)
            logDebug(this@AiInCallService, "SUCCESS: Brought MainActivity to foreground for Call UI!")
          }
        } catch (e: Throwable) {
          logDebug(this@AiInCallService, "ERROR bringing App UI to foreground: ${e.javaClass.simpleName} - ${e.message}")
        }
      }
    } catch (e: Throwable) {
      logDebug(this, "Handler error: ${e.message}")
    }
  }

  override fun onCallAdded(call: Call) {
    try {
      super.onCallAdded(call)
      logDebug(this, "onCallAdded: State = ${call.state}")
      activeCall = call

      val callback = object : Call.Callback() {
        override fun onStateChanged(c: Call, state: Int) {
          try {
            super.onStateChanged(c, state)
            logDebug(this@AiInCallService, "Call Callback onStateChanged: $state")
            if (state == Call.STATE_RINGING) {
              bringAppToForeground()
            }
          } catch (e: Throwable) {
            logDebug(this@AiInCallService, "Callback onStateChanged error: ${e.message}")
          }
        }
      }
      call.registerCallback(callback)

      if (call.state == Call.STATE_RINGING) {
        logDebug(this, "RINGING call detected in InCallService! Bringing UI to foreground for Banner Overlay...")
        bringAppToForeground()
      }
    } catch (e: Throwable) {
      logDebug(this, "FATAL CATCH in onCallAdded: ${e.javaClass.simpleName} - ${e.message}")
    }
  }

  override fun onCallRemoved(call: Call) {
    try {
      super.onCallRemoved(call)
      logDebug(this, "onCallRemoved")
      if (activeCall == call) {
        activeCall = null
      }
    } catch (e: Throwable) {
      logDebug(this, "Error in onCallRemoved: ${e.message}")
    }
  }
}
