package expo.modules.callmanager

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.telecom.TelecomManager
import android.telecom.VideoProfile
import android.telephony.TelephonyManager
import android.telephony.PhoneStateListener
import android.os.Build
import android.Manifest
import android.app.role.RoleManager
import android.content.pm.PackageManager
import android.net.Uri
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
      val lines = newLogs.split("\n").take(50).joinToString("\n")
      prefs.edit().putString("logs", lines).apply()
    } catch (e: Throwable) {
      e.printStackTrace()
    }
  }

  override fun definition() = ModuleDefinition {
    Name("Callmanager")

    Events("onIncomingCall", "onCallAnswered", "onCallEnded", "onDebugLog")

    AsyncFunction("setAiEnabled") { enabled: Boolean ->
      AiInCallService.isAiEnabled = enabled
      val context = appContext.reactContext ?: return@AsyncFunction true
      logDebug(context, "AI State set to: $enabled")
      return@AsyncFunction true
    }

    AsyncFunction("isDefaultDialer") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
        val defaultPackage = telecomManager.defaultDialerPackage
        val isDefault = defaultPackage == context.packageName
        logDebug(context, "isDefaultDialer: isDefault=$isDefault, defaultPackage=${defaultPackage ?: "NULL"}")
        return@AsyncFunction isDefault
      } catch (e: Throwable) {
        logDebug(context, "ERROR in isDefaultDialer: ${e.message}")
        return@AsyncFunction false
      }
    }

    AsyncFunction("requestDefaultDialer") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val activity = appContext.currentActivity
      logDebug(context, "Requesting Default Call Assistant Role...")

      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          val roleManager = context.getSystemService(Context.ROLE_SERVICE) as? RoleManager
          if (roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_DIALER)) {
            val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (activity != null) {
              activity.startActivity(intent)
            } else {
              context.startActivity(intent)
            }
            logDebug(context, "RoleManager Intent launched successfully.")
            return@AsyncFunction true
          }
        }
        val intent = Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER).apply {
          putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, context.packageName)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        if (activity != null) {
          activity.startActivity(intent)
        } else {
          context.startActivity(intent)
        }
        logDebug(context, "TelecomManager Intent launched successfully.")
        return@AsyncFunction true
      } catch (e: Throwable) {
        logDebug(context, "ERROR requesting default dialer: ${e.javaClass.simpleName} - ${e.message}")
        try {
          val settingsIntent = Intent(android.provider.Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          context.startActivity(settingsIntent)
          logDebug(context, "Opened Default Apps Settings fallback screen.")
          return@AsyncFunction true
        } catch (e2: Throwable) {
          logDebug(context, "Fallback failed: ${e2.message}")
        }
        return@AsyncFunction false
      }
    }

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

      AiInCallService.activeCall?.let { call ->
        try {
          call.answer(VideoProfile.STATE_AUDIO_ONLY)
          logDebug(context, "SUCCESS: Answered via AiInCallService activeCall!")
          sendEvent("onCallAnswered", mapOf("success" to true))
          return@AsyncFunction true
        } catch (e: Throwable) {
          logDebug(context, "ERROR in AiInCallService.activeCall.answer(): ${e.message}")
        }
      }

      val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
      val hasPerm = ContextCompat.checkSelfPermission(context, Manifest.permission.ANSWER_PHONE_CALLS) == PackageManager.PERMISSION_GRANTED

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
        }
      }
      return@AsyncFunction false
    }

    AsyncFunction("endCall") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      logDebug(context, "Attempting endCall()...")
      try {
        AiInCallService.activeCall?.let { call ->
          call.disconnect()
          logDebug(context, "SUCCESS: Disconnected call via AiInCallService!")
          sendEvent("onCallEnded", mapOf("success" to true))
          return@AsyncFunction true
        }
        val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          if (ContextCompat.checkSelfPermission(context, Manifest.permission.ANSWER_PHONE_CALLS) == PackageManager.PERMISSION_GRANTED) {
            telecomManager.endCall()
            logDebug(context, "SUCCESS: Ended call via TelecomManager.endCall()!")
            sendEvent("onCallEnded", mapOf("success" to true))
            return@AsyncFunction true
          }
        }
      } catch (e: Throwable) {
        logDebug(context, "ERROR in endCall: ${e.message}")
      }
      return@AsyncFunction false
    }

    AsyncFunction("makeCall") { phoneNumber: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val activity = appContext.currentActivity
      logDebug(context, "Attempting makeCall to: $phoneNumber")
      try {
        val uri = Uri.parse("tel:" + Uri.encode(phoneNumber))
        val intent = Intent(Intent.ACTION_CALL, uri).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        if (activity != null) {
          activity.startActivity(intent)
        } else {
          context.startActivity(intent)
        }
        logDebug(context, "SUCCESS: Initiated outgoing call to $phoneNumber")
        return@AsyncFunction true
      } catch (e: Throwable) {
        logDebug(context, "ERROR in makeCall: ${e.message}")
        return@AsyncFunction false
      }
    }

    AsyncFunction("muteMicrophone") { muted: Boolean ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      logDebug(context, "Setting Mute = $muted")
      try {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        audioManager.isMicrophoneMute = muted
        logDebug(context, "SUCCESS: Microphone Mute set to $muted")
        return@AsyncFunction true
      } catch (e: Throwable) {
        logDebug(context, "ERROR setting mute: ${e.message}")
        return@AsyncFunction false
      }
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
