package com.muslim.backgroundaudio;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Starts/stops a foreground MediaSession service while Quran recitation plays,
 * so Android keeps the app process (and with it the WebView audio) alive in
 * the background.
 */
@CapacitorPlugin(name = "BackgroundAudio")
public class BackgroundAudioPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        String title = call.getString("title", "تلاوة القرآن");
        String artist = call.getString("artist", "مسلم");
        Context context = getContext();
        Intent intent = new Intent(context, MediaPlaybackService.class);
        intent.putExtra("title", title);
        intent.putExtra("artist", artist);
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            call.resolve();
        } catch (Exception exception) {
            String message = exception.getMessage();
            call.reject(message == null ? "Unable to start background audio service" : message);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            getContext().stopService(new Intent(getContext(), MediaPlaybackService.class));
            call.resolve();
        } catch (Exception exception) {
            String message = exception.getMessage();
            call.reject(message == null ? "Unable to stop background audio service" : message);
        }
    }

    @PluginMethod
    public void isActive(PluginCall call) {
        JSObject result = new JSObject();
        result.put("active", MediaPlaybackService.isRunning());
        call.resolve(result);
    }
}
