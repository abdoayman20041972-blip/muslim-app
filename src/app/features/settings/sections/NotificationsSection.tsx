import type { NotificationPermissionState } from '../../notifications/notifications'
import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useState } from 'react'
import { APP_SETTINGS_KEYS, readSetting, writeSetting } from '../../../settings'
import { Toggle } from '../../../components/app-chrome'
import { Row, Section } from '../settingsPrimitives'
import { usePushSubscription } from '../../notifications/pushSubscription'

type NotificationsSectionProps = {
  notificationStatus: NotificationPermissionState
  reminders?: boolean
  prayerTime?: boolean
  dailyAyah: boolean
  quranReminder?: boolean
  quranReminderTime?: string
  azkarMorning: boolean
  azkarEvening: boolean
  notify: () => Promise<boolean>
  toggleNotify: (key:string,setter:(value:boolean)=>void,value:boolean)=>Promise<void>
  setReminders?: Dispatch<SetStateAction<boolean>>
  setPrayerTime?: Dispatch<SetStateAction<boolean>>
  setDailyAyah: Dispatch<SetStateAction<boolean>>
  setQuranReminder?: Dispatch<SetStateAction<boolean>>
  setQuranReminderTime?: Dispatch<SetStateAction<string>>
  setAzkarMorning: Dispatch<SetStateAction<boolean>>
  setAzkarEvening: Dispatch<SetStateAction<boolean>>
}

const enabled = (key: string) => readSetting(key, '0') === '1'

const PUSH_ERROR_MESSAGES: Record<string,string> = {
  unsupported: 'المتصفح لا يدعم الإشعارات الخلفية',
  'permission-denied': 'يجب السماح بالإشعارات أولًا',
  'no-coords': 'حدد موقع الصلاة أولًا من إعدادات الصلاة',
  error: 'تعذّر التفعيل، حاول لاحقًا',
}

export function NotificationsSection({
  notificationStatus,reminders=false,prayerTime=true,dailyAyah,quranReminder=false,quranReminderTime='20:00',azkarMorning,azkarEvening,notify,toggleNotify,
  setReminders=()=>{},setPrayerTime=()=>{},setDailyAyah,setQuranReminder=()=>{},setQuranReminderTime=()=>{},setAzkarMorning,setAzkarEvening,
}: NotificationsSectionProps) {
  const { subscribe, getStatus, hasBrowserSubscription, unsubscribe } = usePushSubscription()
  const [pushState,setPushState] = useState<'idle'|'loading'|'enabled'|'disabled'|'denied'|'error'>('idle')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (notificationStatus === 'denied') {
        if (!cancelled) setPushState('denied')
        return
      }
      const [browser, server] = await Promise.all([hasBrowserSubscription(), getStatus()])
      if (!cancelled) setPushState(browser && server.exists ? 'enabled' : 'disabled')
    }
    void load()
    return () => { cancelled = true }
  }, [notificationStatus])

  const disablePush = async () => {
    setPushState('loading')
    const ok = await unsubscribe()
    setPushState(ok ? 'disabled' : 'error')
  }
  const enablePush = async () => {
    setPushState('loading')
    const result = await subscribe()
    setPushState(result.ok ? 'enabled' : 'error')
  }
  return (
    <Section title="مركز الإشعارات">
      <Row title="السماح بالإشعارات">
        <button onClick={() => void notify()} className="rounded-xl bg-azkar-teal px-3 py-2 text-[10px] font-bold text-azkar-card">
          {notificationStatus === 'granted' ? 'مسموحة' : 'السماح'}
        </button>
      </Row>
      <Row title="الإشعارات الخلفية (تعمل حتى بعد إغلاق التطبيق)">
        <div className="flex flex-col items-end gap-1">
          <button onClick={() => void (pushState === 'enabled' ? disablePush() : enablePush())} disabled={pushState === 'loading'} className="rounded-xl bg-azkar-teal px-3 py-2 text-[10px] font-bold text-azkar-card disabled:opacity-60">
            {pushState === 'loading' ? 'جارٍ المعالجة...' : pushState === 'enabled' ? 'تعطيل' : pushState === 'denied' ? 'الإذن مرفوض' : 'تفعيل'}
          </button>
          {pushState === 'disabled' && (enabled(APP_SETTINGS_KEYS.reminders) || enabled(APP_SETTINGS_KEYS.prayerTime) || quranReminder || dailyAyah || azkarMorning || azkarEvening) && <span className="text-[9px] text-amber-700">إشعاراتك مفعّلة، فعّل الإشعارات الخلفية لتصل بعد إغلاق التطبيق.</span>}
          {pushState === 'error' && <span className="text-[9px] text-red-600">{PUSH_ERROR_MESSAGES.error}</span>}
        </div>
      </Row>
      <Row title="تذكير الصلاة" description="إشعار مستقل عند دخول وقت الصلاة.">
        <Toggle checked={prayerTime} onChange={() => void toggleNotify(APP_SETTINGS_KEYS.prayerTime,setPrayerTime,prayerTime)} label="تذكير الصلاة"/>
      </Row>
      <Row title="تذكير قبل الصلاة بـ٥ دقائق" description="إشعار مستقل قبل كل صلاة بخمس دقائق.">
        <Toggle checked={reminders} onChange={() => void toggleNotify(APP_SETTINGS_KEYS.reminders,setReminders,reminders)} label="قبل الصلاة بـ٥ دقائق"/>
      </Row>
      <Row title="آية اليوم" description="إشعار يومي عند منتصف الليل وفق التنفيذ الحالي">
        <Toggle checked={dailyAyah} onChange={() => void toggleNotify(APP_SETTINGS_KEYS.dailyAyah,setDailyAyah,dailyAyah)} label="آية اليوم"/>
      </Row>
      <Row title="تذكير قراءة القرآن" description="تذكير يومي يفتح المصحف في الوقت الذي تحدده.">
        <div className="flex flex-col items-end gap-2">
          <Toggle checked={quranReminder} onChange={() => void toggleNotify(APP_SETTINGS_KEYS.quranReminder,setQuranReminder,quranReminder)} label="قراءة القرآن"/>
          {quranReminder && <input aria-label="وقت تذكير قراءة القرآن" type="time" value={quranReminderTime} onChange={(event) => { const value=event.target.value; setQuranReminderTime(value); writeSetting(APP_SETTINGS_KEYS.quranReminderTime,value); window.dispatchEvent(new Event('azkar-settings-changed')) }} className="rounded-xl border border-azkar-gold-soft bg-azkar-card px-2 py-1 text-xs" />}
        </div>
      </Row>
      <Row title="أذكار الصباح" description="عند وقت الشروق وفق مواقيت الصلاة المحفوظة">
        <Toggle checked={azkarMorning} onChange={() => void toggleNotify(APP_SETTINGS_KEYS.azkarMorning,setAzkarMorning,azkarMorning)} label="أذكار الصباح"/>
      </Row>
      <Row title="أذكار المساء" description="عند وقت الغروب وفق مواقيت الصلاة المحفوظة" last>
        <Toggle checked={azkarEvening} onChange={() => void toggleNotify(APP_SETTINGS_KEYS.azkarEvening,setAzkarEvening,azkarEvening)} label="أذكار المساء"/>
      </Row>
    </Section>
  )
}