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

  private fun bringAppToForeground() {
    try {
      val mainIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
      }
      if (mainIntent != null) {
        startActivity(mainIntent)
        logDebug(this, "SUCCESS: Brought MainActivity to foreground for Call UI!")
      }
    } catch (e: Throwable) {
        logDebug(this, "ERROR bringing App UI to foreground: ${e.message}")
    }
  }

  override fun onCallAdded(call: Call) {
    super.onCallAdded(call)
    logDebug(this, "onCallAdded: State = ${call.state}")
    activeCall = call

    val callback = object : Call.Callback() {
      override fun onStateChanged(c: Call, state: Int) {
        super.onStateChanged(c, state)
        logDebug(this@AiInCallService, "Call Callback onStateChanged: $state")
        if (state == Call.STATE_RINGING && isAiEnabled) {
          try {
            c.answer(VideoProfile.STATE_AUDIO_ONLY)
            logDebug(this@AiInCallService, "SUCCESS: Answered via Callback!")
            bringAppToForeground()
          } catch (e: Throwable) {
            logDebug(this@AiInCallService, "ERROR in Callback answer: ${e.message}")
          }
        }
      }
    }
    call.registerCallback(callback)

    if (call.state == Call.STATE_RINGING) {
      logDebug(this, "RINGING call detected in InCallService!")
      if (isAiEnabled) {
        logDebug(this, "AI is ACTIVE! Answering call via Telecom Call.answer()...")
        try {
          call.answer(VideoProfile.STATE_AUDIO_ONLY)
          logDebug(this, "SUCCESS: Call.answer(STATE_AUDIO_ONLY) executed!")
          bringAppToForeground()
        } catch (e: Throwable) {
          logDebug(this, "ERROR answering call in InCallService: ${e.javaClass.simpleName} - ${e.message}")
        }
      } else {
        logDebug(this, "AI is OFFLINE. Skipping auto-answer.")
      }
    }
  }

  override fun onCallRemoved(call: Call) {
    super.onCallRemoved(call)
    logDebug(this, "onCallRemoved")
    if (activeCall == call) {
      activeCall = null
    }
  }
}
