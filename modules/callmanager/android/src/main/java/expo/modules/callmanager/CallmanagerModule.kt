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
import android.speech.tts.TextToSpeech
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.media.Ringtone
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class CallmanagerModule : Module() {

  private var phoneStateListener: PhoneStateListener? = null
  private var isTtsReady = false

  companion object {
    var tts: TextToSpeech? = null
    var instance: CallmanagerModule? = null
    var ringtone: Ringtone? = null

    fun emitNativeEvent(eventName: String, body: Map<String, Any?>) {
      try {
        instance?.sendEvent(eventName, body)
      } catch (e: Throwable) {
        e.printStackTrace()
      }
    }

    fun startRingtone(context: Context) {
      try {
        if (ringtone == null || !(ringtone?.isPlaying ?: false)) {
          val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
          ringtone = RingtoneManager.getRingtone(context, uri)
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            ringtone?.isLooping = true
          }
        }
        ringtone?.play()
        logDebug(context, "SUCCESS: Started native Ringtone playback!")
      } catch (e: Throwable) {
        logDebug(context, "ERROR starting ringtone: ${e.message}")
      }
    }

    fun stopRingtone(context: Context) {
      try {
        ringtone?.stop()
        ringtone = null
        logDebug(context, "SUCCESS: Stopped native Ringtone playback")
      } catch (e: Throwable) {}
    }

    fun stopNativeTtsEngine() {
      try {
        tts?.stop()
      } catch (e: Throwable) {}
    }

    fun vibrateCallConnected(context: Context) {
      try {
        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? android.os.Vibrator
        if (vibrator != null && vibrator.hasVibrator()) {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(android.os.VibrationEffect.createOneShot(120, android.os.VibrationEffect.DEFAULT_AMPLITUDE))
          } else {
            vibrator.vibrate(120)
          }
          logDebug(context, "SUCCESS: Triggered 120ms Call Connected Haptic Vibration!")
        }
      } catch (e: Throwable) {
        logDebug(context, "ERROR in vibrateCallConnected: ${e.message}")
      }
    }

    fun logDebug(context: Context, message: String) {
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
  }

  private fun initNativeTts(context: Context) {
    if (tts == null) {
      try {
        tts = TextToSpeech(context) { status ->
          if (status == TextToSpeech.SUCCESS) {
            isTtsReady = true
            tts?.language = Locale("en", "IN") // Force Indian English for natural Hinglish
            tts?.setSpeechRate(0.92f)
            tts?.setPitch(1.0f)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
              val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
              tts?.setAudioAttributes(audioAttributes)
            }
            logDebug(context, "SUCCESS: Native Telecom TextToSpeech Initialized!")
          } else {
            logDebug(context, "ERROR initializing Native TTS: status=$status")
          }
        }
      } catch (e: Throwable) {
        logDebug(context, "ERROR in initNativeTts: ${e.message}")
      }
    }
  }

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

    OnCreate {
      instance = this@CallmanagerModule
    }

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
      stopRingtone(context)
      AiInCallService.cancelAutoAnswerTimer()

      AiInCallService.activeCall?.let { call ->
        try {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            call.answer(0)
          } else {
            call.answer(VideoProfile.STATE_AUDIO_ONLY)
          }
          vibrateCallConnected(context)
          logDebug(context, "SUCCESS: Answered via AiInCallService activeCall!")
          sendEvent("onCallAnswered", mapOf("success" to true))
          return@AsyncFunction true
        } catch (e: Throwable) {
          logDebug(context, "ERROR in activeCall.answer(): ${e.message}")
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
            logDebug(context, "ERROR in acceptRingingCall: ${e.message}")
          }
        }
      }
      return@AsyncFunction false
    }

    AsyncFunction("endCall") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      logDebug(context, "Attempting endCall()...")
      stopRingtone(context)
      AiInCallService.cancelAutoAnswerTimer()

      AiInCallService.activeCall?.let { call ->
        try {
          call.disconnect()
          logDebug(context, "SUCCESS: Disconnected call via AiInCallService!")
          sendEvent("onCallEnded", mapOf("success" to true))
          return@AsyncFunction true
        } catch (e: Throwable) {
          logDebug(context, "ERROR disconnecting via activeCall: ${e.message}")
        }
      }

      val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        try {
          telecomManager.endCall()
          logDebug(context, "SUCCESS: Ended call via telecomManager.endCall()")
          sendEvent("onCallEnded", mapOf("success" to true))
          return@AsyncFunction true
        } catch (e: Throwable) {
          logDebug(context, "ERROR in telecomManager.endCall(): ${e.message}")
        }
      }
      return@AsyncFunction false
    }

    AsyncFunction("makeCall") { phoneNumber: String, simSlotIndex: Int? ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val slot = simSlotIndex ?: 0
      logDebug(context, "Attempting makeCall to: $phoneNumber on SIM slot $slot")
      try {
        val uri = Uri.parse("tel:" + Uri.encode(phoneNumber))
        val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager

        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED) {
          val extras = android.os.Bundle().apply {
            putInt("com.android.phone.extra.slot", slot)
            putInt("simSlot", slot)
            putInt("subscription", slot)
          }

          if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) {
            try {
              val accounts = telecomManager.callCapablePhoneAccounts
              if (accounts != null && accounts.size > slot) {
                extras.putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, accounts[slot])
                logDebug(context, "Attached PhoneAccountHandle for SIM ${slot + 1}: ${accounts[slot]}")
              }
            } catch (e: Throwable) {
              logDebug(context, "PhoneAccountHandle resolution warning: ${e.message}")
            }
          }

          // Direct Telecom Call Placement - NO 'Open With' Popups!
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            telecomManager.placeCall(uri, extras)
            logDebug(context, "SUCCESS: Direct Telecom placeCall executed for $phoneNumber on SIM ${slot + 1}")
            return@AsyncFunction true
          }
        }

        // Fallback explicit intent
        val intent = Intent(Intent.ACTION_CALL, uri).apply {
          setPackage("com.android.phone")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          putExtra("com.android.phone.extra.slot", slot)
          putExtra("simSlot", slot)
        }
        context.startActivity(intent)
        logDebug(context, "SUCCESS: Explicit Intent outgoing call to $phoneNumber on SIM ${slot + 1}")
        return@AsyncFunction true
      } catch (e: Throwable) {
        logDebug(context, "ERROR in makeCall: ${e.message}")
        return@AsyncFunction false
      }
    }

    AsyncFunction("speakCallAudio") { text: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      // Sanitize ALL robotic acronym variations and punctuation for natural human speech
      val regex = Regex("[^a-zA-Z0-9 ]")
      val cleanText = text.replace(Regex("(?i)j[.\\-]?a[.\\-]?r[.\\-]?v[.\\-]?i[.\\-]?s"), "Jarvis")
                          .replace(regex, "")
      logDebug(context, "Attempting native speakCallAudio: $cleanText")
      try {
        // Force Audio Mode to IN_CALL so TTS routes to uplink (caller) on all ROMs
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
        audioManager.mode = android.media.AudioManager.MODE_IN_CALL
        
        initNativeTts(context)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
          tts?.speak(cleanText, TextToSpeech.QUEUE_FLUSH, null, "AiCallSpeech_${System.currentTimeMillis()}")
        } else {
          @Suppress("DEPRECATION")
          tts?.speak(cleanText, TextToSpeech.QUEUE_FLUSH, null)
        }
        logDebug(context, "SUCCESS: Spoke call audio natively via USAGE_VOICE_COMMUNICATION")
        return@AsyncFunction true
      } catch (e: Throwable) {
        logDebug(context, "ERROR in speakCallAudio: ${e.message}")
        return@AsyncFunction false
      }
    }

    AsyncFunction("stopCallAudio") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        tts?.stop()
        logDebug(context, "SUCCESS: Stopped native TTS call audio")
        return@AsyncFunction true
      } catch (e: Throwable) {
        return@AsyncFunction false
      }
    }

    AsyncFunction("getSimCardsInfo") {
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
      val simList = mutableListOf<Map<String, Any>>()
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
          val subManager = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? android.telephony.SubscriptionManager
          if (subManager != null && ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) {
            val activeList = subManager.activeSubscriptionInfoList
            if (activeList != null) {
              for (info in activeList) {
                val slotIndex = info.simSlotIndex
                val carrierName = info.carrierName?.toString() ?: info.displayName?.toString() ?: "SIM ${slotIndex + 1}"
                simList.add(mapOf(
                  "slot" to slotIndex,
                  "name" to "SIM ${slotIndex + 1} • $carrierName",
                  "carrier" to carrierName
                ))
              }
            }
          }
        }
      } catch (e: Throwable) {
        logDebug(context, "ERROR fetching SIM info: ${e.message}")
      }
      if (simList.isEmpty()) {
        simList.add(mapOf("slot" to 0, "name" to "SIM 1 • Jio 4G / Airtel", "carrier" to "Jio"))
        simList.add(mapOf("slot" to 1, "name" to "SIM 2 • Primary Voice", "carrier" to "Voice"))
      }
      return@AsyncFunction simList
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
        audioManager.mode = AudioManager.MODE_IN_CALL
        audioManager.isSpeakerphoneOn = enable

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          AiInCallService.instance?.setAudioRoute(
            if (enable) android.telecom.CallAudioState.ROUTE_SPEAKER
            else android.telecom.CallAudioState.ROUTE_EARPIECE
          )
        }
        logDebug(context, "SUCCESS: Speakerphone set to $enable with MODE_IN_CALL")
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
            var previousState = TelephonyManager.CALL_STATE_IDLE
            override fun onCallStateChanged(state: Int, phoneNumber: String?) {
              super.onCallStateChanged(state, phoneNumber)
              try {
                val stateName = when (state) {
                  TelephonyManager.CALL_STATE_RINGING -> "RINGING"
                  TelephonyManager.CALL_STATE_OFFHOOK -> "OFFHOOK"
                  TelephonyManager.CALL_STATE_IDLE -> "IDLE"
                  else -> "UNKNOWN($state)"
                }
                logDebug(context, "onCallStateChanged: $stateName (prev=${previousState}), Number: ${phoneNumber ?: "NULL"}")

                when (state) {
                  TelephonyManager.CALL_STATE_RINGING -> {
                    sendEvent("onIncomingCall", mapOf("phoneNumber" to (phoneNumber ?: "")))
                  }
                  TelephonyManager.CALL_STATE_OFFHOOK -> {
                    // CRITICAL FIX: Only emit onCallAnswered if previous state was RINGING (incoming call)
                    // For outgoing calls, previousState is IDLE -> OFFHOOK, so we skip
                    if (previousState == TelephonyManager.CALL_STATE_RINGING) {
                      sendEvent("onCallAnswered", mapOf("phoneNumber" to (phoneNumber ?: "")))
                    }
                  }
                  TelephonyManager.CALL_STATE_IDLE -> {
                    sendEvent("onCallEnded", mapOf("phoneNumber" to (phoneNumber ?: "")))
                  }
                }
                previousState = state
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

    AsyncFunction("getRealCallLogs") {
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
      val logs = mutableListOf<Map<String, Any>>()
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) {
        logDebug(context, "Permission READ_CALL_LOG not granted")
        return@AsyncFunction logs
      }

      try {
        val cursor = context.contentResolver.query(
          android.provider.CallLog.Calls.CONTENT_URI,
          arrayOf(
            android.provider.CallLog.Calls._ID,
            android.provider.CallLog.Calls.NUMBER,
            android.provider.CallLog.Calls.CACHED_NAME,
            android.provider.CallLog.Calls.TYPE,
            android.provider.CallLog.Calls.DATE,
            android.provider.CallLog.Calls.DURATION
          ),
          null, null, "${android.provider.CallLog.Calls.DATE} DESC"
        )

        cursor?.use { c ->
          val numberIdx = c.getColumnIndex(android.provider.CallLog.Calls.NUMBER)
          val nameIdx = c.getColumnIndex(android.provider.CallLog.Calls.CACHED_NAME)
          val typeIdx = c.getColumnIndex(android.provider.CallLog.Calls.TYPE)
          val dateIdx = c.getColumnIndex(android.provider.CallLog.Calls.DATE)
          val durationIdx = c.getColumnIndex(android.provider.CallLog.Calls.DURATION)

          var count = 0
          while (c.moveToNext() && count < 50) {
            val num = if (numberIdx >= 0) c.getString(numberIdx) ?: "" else ""
            val name = if (nameIdx >= 0) c.getString(nameIdx) ?: num else num
            val typeInt = if (typeIdx >= 0) c.getInt(typeIdx) else 1
            val dateLong = if (dateIdx >= 0) c.getLong(dateIdx) else 0L
            val durSec = if (durationIdx >= 0) c.getLong(durationIdx) else 0L

            val typeStr = when (typeInt) {
              android.provider.CallLog.Calls.INCOMING_TYPE -> "incoming"
              android.provider.CallLog.Calls.OUTGOING_TYPE -> "outgoing"
              android.provider.CallLog.Calls.MISSED_TYPE -> "missed"
              else -> "incoming"
            }

            val timeStr = SimpleDateFormat("dd MMM, hh:mm a", Locale.getDefault()).format(Date(dateLong))
            val durStr = "${durSec / 60}m ${durSec % 60}s"

            logs.add(mapOf(
              "id" to (count + 1).toString(),
              "name" to if (!name.isNullOrEmpty()) name else (if (num.isNotEmpty()) num else "Unknown"),
              "number" to num,
              "type" to typeStr,
              "time" to timeStr,
              "duration" to durStr
            ))
            count++
          }
        }
        logDebug(context, "SUCCESS: Fetched ${logs.size} real call logs")
      } catch (e: Throwable) {
        logDebug(context, "ERROR fetching call logs: ${e.message}")
      }
      return@AsyncFunction logs
    }

    AsyncFunction("getRealContacts") {
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
      val contacts = mutableListOf<Map<String, Any>>()
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
        logDebug(context, "Permission READ_CONTACTS not granted")
        return@AsyncFunction contacts
      }

      try {
        val cursor = context.contentResolver.query(
          android.provider.ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
          arrayOf(
            android.provider.ContactsContract.CommonDataKinds.Phone._ID,
            android.provider.ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            android.provider.ContactsContract.CommonDataKinds.Phone.NUMBER
          ),
          null, null, "${android.provider.ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC"
        )

        cursor?.use { c ->
          val nameIdx = c.getColumnIndex(android.provider.ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
          val numberIdx = c.getColumnIndex(android.provider.ContactsContract.CommonDataKinds.Phone.NUMBER)

          val seenNumbers = mutableSetOf<String>()
          var count = 0
          while (c.moveToNext() && count < 5000) {
            val name = if (nameIdx >= 0) c.getString(nameIdx) ?: "" else ""
            val number = if (numberIdx >= 0) c.getString(numberIdx) ?: "" else ""

            val cleanNum = number.replace("\\s+".toRegex(), "")
            if (cleanNum.isNotEmpty() && !seenNumbers.contains(cleanNum)) {
              seenNumbers.add(cleanNum)
              contacts.add(mapOf(
                "id" to (count + 1).toString(),
                "name" to if (name.isNotEmpty()) name else number,
                "number" to number,
                "category" to "Contact"
              ))
              count++
            }
          }
        }
        logDebug(context, "SUCCESS: Fetched ${contacts.size} real contacts from phonebook")
      } catch (e: Throwable) {
        logDebug(context, "ERROR fetching contacts: ${e.message}")
      }
      return@AsyncFunction contacts
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
