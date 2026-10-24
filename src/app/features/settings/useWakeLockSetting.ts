import { useEffect } from 'react'
import { APP_SETTINGS_KEYS, readSetting } from '../../settings'

export function useWakeLockSetting() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const acquire = async () => {
      if (readSetting(APP_SETTINGS_KEYS.keepScreenAwake, '0') !== '1' || !('wakeLock' in navigator))
        return
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {}
    }
    const release = () => {
      if (lock) {
        void lock.release()
        lock = null
      }
    }
    const sync = () => {
      release()
      void acquire()
    }
    void acquire()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    window.addEventListener('azkar-settings-changed', sync)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      release()
      window.removeEventListener('azkar-settings-changed', sync)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}
