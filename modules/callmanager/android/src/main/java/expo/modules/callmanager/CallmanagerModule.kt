package expo.modules.callmanager

import android.content.Context
import android.media.AudioManager
import android.telecom.TelecomManager
import android.telephony.TelephonyManager
import android.telephony.PhoneStateListener
import android.os.Build
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class CallmanagerModule : Module() {

  private var phoneStateListener: PhoneStateListener? = null

  private fun logDebug(context: Context, message: String) {
    try {
      val prefs = context.getSharedPreferences("callmanager_debug", Context.MODE_PRIVATE)
      val timeStamp = SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(Date())
      val existingLogs = prefs.getString("logs", "") ?: ""
      val newLogs = "[$timeStamp] $message\n$existingLogs"
      // Keep only last ~50 lines
      val lines = newLogs.split("\n").take(50).joinToString("\n")
      prefs.edit().putString("logs", lines).apply()
    } catch (e: Throwable) {
      e.printStackTrace()
    }
  }

  override fun definition() = ModuleDefinition {
    Name("Callmanager")

    Events("onIncomingCall", "onCallAnswered", "onCallEnded", "onDebugLog")

    AsyncFunction("getDebugLogs") {
      val context = appContext.reactContext ?: return@AsyncFunction ""
      val prefs = context.getSharedPreferences("callmanager_debug", Context.MODE_PRIVATE)
      return@AsyncFunction prefs.getString("logs", "No logs recorded yet.") ?: ""
    }

    AsyncFunction("clearDebugLogs") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val prefs = context.getSharedPreferences("callmanager_debug", Context.MODE_PRIVATE)
      prefs.edit().remove("logs").apply()
      return@AsyncFunction true
    }

    AsyncFunction("answerCall") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      logDebug(context, "Attempting answerCall()...")
      
      val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager

      val hasPerm = ContextCompat.checkSelfPermission(context, Manifest.permission.ANSWER_PHONE_CALLS) == PackageManager.PERMISSION_GRANTED
      logDebug(context, "ANSWER_PHONE_CALLS permission granted: $hasPerm")

      if (hasPerm) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          try {
            telecomManager.acceptRingingCall()
            logDebug(context, "SUCCESS: telecomManager.acceptRingingCall() called")
            sendEvent("onCallAnswered", mapOf("success" to true))
            return@AsyncFunction true
          } catch (e: Throwable) {
            logDebug(context, "ERROR in acceptRingingCall: ${e.javaClass.simpleName} - ${e.message}")
            e.printStackTrace()
            return@AsyncFunction false
          }
        } else {
          logDebug(context, "ERROR: Android version < O (26)")
        }
      } else {
        logDebug(context, "ERROR: Missing ANSWER_PHONE_CALLS permission!")
      }
      return@AsyncFunction false
    }

    AsyncFunction("enableSpeakerphone") { enable: Boolean ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      logDebug(context, "Setting Speakerphone = $enable")
      try {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        audioManager.isSpeakerphoneOn = enable
        logDebug(context, "SUCCESS: Speakerphone set to $enable")
        return@AsyncFunction true
      } catch (e: Throwable) {
        logDebug(context, "ERROR setting speakerphone: ${e.javaClass.simpleName} - ${e.message}")
        return@AsyncFunction false
      }
    }

    AsyncFunction("startListening") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      logDebug(context, "Attempting startListening()...")
      val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

      val hasReadPhoneState = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED
      logDebug(context, "READ_PHONE_STATE permission granted: $hasReadPhoneState")

      if (hasReadPhoneState) {
        if (phoneStateListener == null) {
          phoneStateListener = object : PhoneStateListener() {
            override fun onCallStateChanged(state: Int, phoneNumber: String?) {
              super.onCallStateChanged(state, phoneNumber)
              try {
                val stateName = when (state) {
                  TelephonyManager.CALL_STATE_RINGING -> "RINGING"
                  TelephonyManager.CALL_STATE_OFFHOOK -> "OFFHOOK"
                  TelephonyManager.CALL_STATE_IDLE -> "IDLE"
                  else -> "UNKNOWN($state)"
                }
                logDebug(context, "onCallStateChanged: $stateName, Number: ${phoneNumber ?: "NULL"}")

                when (state) {
                  TelephonyManager.CALL_STATE_RINGING -> {
                    sendEvent("onIncomingCall", mapOf("phoneNumber" to (phoneNumber ?: "")))
                  }
                  TelephonyManager.CALL_STATE_OFFHOOK -> {
                    sendEvent("onCallAnswered", mapOf("phoneNumber" to (phoneNumber ?: "")))
                  }
                  TelephonyManager.CALL_STATE_IDLE -> {
                    sendEvent("onCallEnded", mapOf("phoneNumber" to (phoneNumber ?: "")))
                  }
                }
              } catch (e: Throwable) {
                logDebug(context, "FATAL ERROR in onCallStateChanged: ${e.javaClass.simpleName} - ${e.message}")
                e.printStackTrace()
              }
            }
          }
        }
        try {
          telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE)
          logDebug(context, "SUCCESS: PhoneStateListener registered for LISTEN_CALL_STATE")
          return@AsyncFunction true
        } catch (e: Throwable) {
          logDebug(context, "ERROR registering PhoneStateListener: ${e.javaClass.simpleName} - ${e.message}")
          e.printStackTrace()
        }
      } else {
        logDebug(context, "ERROR: Missing READ_PHONE_STATE permission")
      }
      return@AsyncFunction false
    }

    AsyncFunction("stopListening") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      logDebug(context, "stopListening() called")
      try {
        val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
        phoneStateListener?.let {
          telephonyManager.listen(it, PhoneStateListener.LISTEN_NONE)
        }
        return@AsyncFunction true
      } catch (e: Throwable) {
        logDebug(context, "ERROR in stopListening: ${e.message}")
        return@AsyncFunction false
      }
    }
  }
}
