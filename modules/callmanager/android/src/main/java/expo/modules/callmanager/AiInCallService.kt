package expo.modules.callmanager

import android.telecom.Call
import android.telecom.InCallService
import android.telecom.VideoProfile
import android.content.Context
import android.content.Intent
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.os.Build
import androidx.core.app.NotificationCompat

class AiInCallService : InCallService() {

  private var wakeLock: android.os.PowerManager.WakeLock? = null

  companion object {
    var instance: AiInCallService? = null
    var activeCall: Call? = null
    var isAiEnabled: Boolean = true
    private var autoAnswerHandler: android.os.Handler? = null
    private var autoAnswerRunnable: Runnable? = null

    fun cancelAutoAnswerTimer() {
      try {
        if (autoAnswerRunnable != null && autoAnswerHandler != null) {
          autoAnswerHandler?.removeCallbacks(autoAnswerRunnable!!)
          autoAnswerRunnable = null
        }
      } catch (e: Throwable) {}
    }

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
    cancelAutoAnswerTimer()
    cancelCallNotification()
    if (instance == this) instance = null
  }

  private fun wakeUpScreenHardware() {
    try {
      val pm = getSystemService(Context.POWER_SERVICE) as? android.os.PowerManager
      if (pm != null && !pm.isInteractive) {
        @Suppress("DEPRECATION")
        wakeLock = pm.newWakeLock(
          android.os.PowerManager.FULL_WAKE_LOCK or
          android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP or
          android.os.PowerManager.ON_AFTER_RELEASE,
          "ai_caller:incoming_call_wake_max"
        )
        wakeLock?.acquire(10000)
        logDebug(this, "SUCCESS: Woke up physical screen hardware for Lockscreen Banner!")
      }
    } catch (e: Throwable) {
      logDebug(this, "WakeLock warning: ${e.message}")
    }
  }

  private fun showFullScreenCallNotification(callerNumber: String) {
    try {
      wakeUpScreenHardware()
      val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val channelId = "ai_caller_full_screen_channel"

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val channel = NotificationChannel(
          channelId,
          "Incoming Call Banner",
          NotificationManager.IMPORTANCE_MAX
        ).apply {
          description = "Full screen notification for incoming calls"
          setBypassDnd(true)
          lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        notificationManager.createNotificationChannel(channel)
      }

      val fullScreenIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
        action = Intent.ACTION_MAIN
        addCategory(Intent.CATEGORY_LAUNCHER)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
      }

      val fullScreenPendingIntent = PendingIntent.getActivity(
        this,
        0,
        fullScreenIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
      )

      val notificationBuilder = NotificationCompat.Builder(this, channelId)
        .setSmallIcon(android.R.drawable.ic_menu_call)
        .setContentTitle("INCOMING TELECOM CALL")
        .setContentText(callerNumber)
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setCategory(NotificationCompat.CATEGORY_CALL)
        .setFullScreenIntent(fullScreenPendingIntent, true)
        .setAutoCancel(true)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

      startForeground(1001, notificationBuilder.build())
      logDebug(this, "SUCCESS: Posted FullScreenIntent Notification for Lockscreen Banner!")
    } catch (e: Throwable) {
      logDebug(this, "ERROR posting FullScreenIntent: ${e.message}")
    }
  }

  private fun cancelCallNotification() {
    try {
      stopForeground(true)
      val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager.cancel(1001)
    } catch (e: Throwable) {}
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

  fun enableNativeSpeakerphone(enable: Boolean) {
    try {
      val audioManager = getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
      audioManager.mode = android.media.AudioManager.MODE_IN_CALL
      audioManager.isSpeakerphoneOn = enable

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        setAudioRoute(
          if (enable) android.telecom.CallAudioState.ROUTE_SPEAKER
          else android.telecom.CallAudioState.ROUTE_EARPIECE
        )
      }
      logDebug(this, "SUCCESS: Native Speakerphone set to $enable")
    } catch (e: Throwable) {
      logDebug(this, "ERROR setting native speakerphone: ${e.message}")
    }
  }

  private var isIncomingCall = false

  override fun onCallAdded(call: Call) {
    try {
      super.onCallAdded(call)
      logDebug(this, "onCallAdded: State = ${call.state}")
      activeCall = call
      isIncomingCall = (call.state == Call.STATE_RINGING)

      val callback = object : Call.Callback() {
        override fun onStateChanged(c: Call, state: Int) {
          try {
            super.onStateChanged(c, state)
            logDebug(this@AiInCallService, "Call Callback onStateChanged: $state")
            if (state == Call.STATE_RINGING) {
              // DO NOT set isIncomingCall here - it's already set in onCallAdded
              // Some Android ROMs fire STATE_RINGING for outgoing "alerting" phase
              val number = c.details?.handle?.schemeSpecificPart ?: "Incoming Call"
              showFullScreenCallNotification(number)
              bringAppToForeground()
            } else if (state == Call.STATE_ACTIVE) {
              cancelCallNotification()
              enableNativeSpeakerphone(true)
              CallmanagerModule.vibrateCallConnected(this@AiInCallService)
              CallmanagerModule.emitNativeEvent("onCallAnswered", mapOf("success" to true, "isIncoming" to isIncomingCall))
            } else if (state == Call.STATE_DISCONNECTED) {
              cancelCallNotification()
              enableNativeSpeakerphone(false)
              CallmanagerModule.emitNativeEvent("onCallEnded", mapOf("success" to true))
            }
          } catch (e: Throwable) {
            logDebug(this@AiInCallService, "Callback onStateChanged error: ${e.message}")
          }
        }
      }
      call.registerCallback(callback)

      if (call.state == Call.STATE_RINGING) {
        isIncomingCall = true
        val callerNum = call.details?.handle?.schemeSpecificPart ?: "Incoming Call"
        logDebug(this, "RINGING call detected in InCallService! Starting ringtone, FullScreenIntent, and 10s Native Auto-Answer...")
        CallmanagerModule.startRingtone(this)
        showFullScreenCallNotification(callerNum)
        bringAppToForeground()

        if (isAiEnabled) {
          cancelAutoAnswerTimer()
          autoAnswerHandler = android.os.Handler(android.os.Looper.getMainLooper())
          autoAnswerRunnable = Runnable {
            try {
              if (activeCall != null && activeCall?.state == Call.STATE_RINGING) {
                logDebug(this@AiInCallService, "10 SECONDS RINGING ELAPSED! Native J.A.R.V.I.S Auto-Answering Call NOW...")
                CallmanagerModule.stopRingtone(this@AiInCallService)
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                  activeCall?.answer(0)
                } else {
                  activeCall?.answer(android.telecom.VideoProfile.STATE_AUDIO_ONLY)
                }
                logDebug(this@AiInCallService, "SUCCESS: 10s Native Auto-Answer Executed!")
                enableNativeSpeakerphone(true)
                CallmanagerModule.emitNativeEvent("onCallAnswered", mapOf("success" to true, "isIncoming" to true))
              }
            } catch (e: Throwable) {
              logDebug(this@AiInCallService, "ERROR in 10s Native Auto-Answer: ${e.message}")
            }
          }
          autoAnswerHandler?.postDelayed(autoAnswerRunnable!!, 10000)
        }
      }
    } catch (e: Throwable) {
      logDebug(this, "FATAL CATCH in onCallAdded: ${e.javaClass.simpleName} - ${e.message}")
    }
  }

  override fun onCallRemoved(call: Call) {
    try {
      super.onCallRemoved(call)
      logDebug(this, "onCallRemoved")
      
      // 1. Force Cancel Notifications (Fixes Orphaned Banner)
      cancelCallNotification()
      
      // 2. Stop TTS Engine (Fixes Zombie TTS)
      CallmanagerModule.stopNativeTtsEngine()
      
      cancelAutoAnswerTimer()
      CallmanagerModule.stopRingtone(this)
      
      // 3. Release WakeLock early (Fixes Battery Drain)
      try {
        if (wakeLock?.isHeld == true) {
          wakeLock?.release()
          wakeLock = null
          logDebug(this, "SUCCESS: WakeLock released early onCallRemoved")
        }
      } catch (e: Throwable) {}
      // CRITICAL FIX: Reset audio mode to NORMAL so speaker routing is restored for media playback
      try {
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
        audioManager.mode = android.media.AudioManager.MODE_NORMAL
        audioManager.isSpeakerphoneOn = false
        logDebug(this, "SUCCESS: Audio mode reset to MODE_NORMAL")
      } catch (e: Throwable) {
        logDebug(this, "Warning resetting audio mode: ${e.message}")
      }
      if (activeCall == call) {
        activeCall = null
      }
    } catch (e: Throwable) {
      logDebug(this, "Error in onCallRemoved: ${e.message}")
    }
  }
}
