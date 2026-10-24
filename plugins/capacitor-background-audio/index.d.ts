export interface StartOptions {
  /** Notification / MediaSession title, e.g. the surah name. */
  title?: string
  /** Notification / MediaSession artist, e.g. the reciter name. */
  artist?: string
}

export interface BackgroundAudioPlugin {
  /**
   * Start the native foreground MediaSession service (Android only) so the
   * WebView audio keeps playing after the app moves to the background.
   */
  start(options: StartOptions): Promise<void>
  /** Stop the service when playback pauses or stops. */
  stop(): Promise<void>
  /** Whether the background service is currently running. */
  isActive(): Promise<{ active: boolean }>
}

export declare const BackgroundAudio: BackgroundAudioPlugin
