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

class CallmanagerModule : Module() {

  private var phoneStateListener: PhoneStateListener? = null

  override fun definition() = ModuleDefinition {
    Name("Callmanager")

    Events("onIncomingCall", "onCallAnswered", "onCallEnded")

    AsyncFunction("answerCall") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager

      if (ContextCompat.checkSelfPermission(context, Manifest.permission.ANSWER_PHONE_CALLS) == PackageManager.PERMISSION_GRANTED) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          try {
            telecomManager.acceptRingingCall()
            sendEvent("onCallAnswered", mapOf("success" to true))
            return@AsyncFunction true
          } catch (e: Exception) {
            e.printStackTrace()
            return@AsyncFunction false
          }
        }
      }
      return@AsyncFunction false
    }

    AsyncFunction("enableSpeakerphone") { enable: Boolean ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      audioManager.isSpeakerphoneOn = enable
      return@AsyncFunction true
    }

    AsyncFunction("startListening") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

      if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) {
        if (phoneStateListener == null) {
          phoneStateListener = object : PhoneStateListener() {
            override fun onCallStateChanged(state: Int, phoneNumber: String?) {
              super.onCallStateChanged(state, phoneNumber)
              try {
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
              } catch (e: Exception) {
                e.printStackTrace()
              }
            }
          }
        }
        try {
          telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE)
          return@AsyncFunction true
        } catch (e: SecurityException) {
          e.printStackTrace()
        }
      }
      return@AsyncFunction false
    }

    AsyncFunction("stopListening") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
      phoneStateListener?.let {
        telephonyManager.listen(it, PhoneStateListener.LISTEN_NONE)
      }
      return@AsyncFunction true
    }
  }
}

