package expo.modules.callmanager

import android.telecom.Call
import android.telecom.InCallService
import android.telecom.VideoProfile
import android.content.Context
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

  override fun onCallAdded(call: Call?) {
    super.onCallAdded(call)
    logDebug(this, "onCallAdded: State = ${call?.state}")
    activeCall = call

    if (call?.state == Call.STATE_RINGING) {
      logDebug(this, "RINGING call detected in InCallService!")
      if (isAiEnabled) {
        logDebug(this, "AI is ACTIVE! Answering call via Telecom Call.answer()...")
        try {
          call.answer(VideoProfile.STATE_AUDIO_ONLY)
          logDebug(this, "SUCCESS: Call.answer(STATE_AUDIO_ONLY) executed!")
        } catch (e: Throwable) {
          logDebug(this, "ERROR answering call in InCallService: ${e.javaClass.simpleName} - ${e.message}")
        }
      } else {
        logDebug(this, "AI is OFFLINE. Skipping auto-answer.")
      }
    }
  }

  override fun onCallRemoved(call: Call?) {
    super.onCallRemoved(call)
    logDebug(this, "onCallRemoved")
    if (activeCall == call) {
      activeCall = null
    }
  }
}
