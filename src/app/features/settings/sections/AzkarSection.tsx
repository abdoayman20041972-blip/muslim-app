import { useState, type Dispatch, type SetStateAction } from 'react'
import { Toggle } from '../../../components/app-chrome'
import { useConfirmDialog } from '../../../components/confirm-dialog'
import { APP_SETTINGS_KEYS } from '../../../settings'
import { clearAzkarProgressDay } from '../../azkar/azkarProgress'
import { Row, Section, Choice } from '../settingsPrimitives'

type AzkarSectionProps = {
  azkarCounter: boolean
  setAzkarCounter: Dispatch<SetStateAction<boolean>>
  journeyAutoAdvance: boolean
  setJourneyAutoAdvance: Dispatch<SetStateAction<boolean>>
  toggle: (key: string, setter: (value: boolean) => void, value: boolean) => void
  save: (key: string, value: string) => void
}

type AzkarSettingsCategory = 'reading' | 'counter' | 'journey' | 'interaction' | 'data'

const CATEGORIES = [
  { id: 'reading' as const, title: 'تجربة القراءة', description: 'طريقة عرض الأذكار أثناء القراءة', icon: '◉' },
  { id: 'counter' as const, title: 'العداد والتقدم', description: 'العداد المرتبط بكل ذكر', icon: '◎' },
  { id: 'journey' as const, title: 'رحلة الأذكار', description: 'سلوك الانتقال داخل الرحلة', icon: '➜' },
  { id: 'interaction' as const, title: 'التفاعل', description: 'إعدادات التفاعل مع الأذكار', icon: '✦' },
  { id: 'data' as const, title: 'التقدم والبيانات', description: 'التقدم المحلي وإدارته', icon: '▣' },
]

function EmptyCategory({ title }: { title: string }) {
  return (
    <Section title={title}>
      <div className="px-4 py-5 text-right text-[10px] leading-5 text-azkar-ink-soft">
        لا توجد إعدادات مستقلة لهذه الفئة حاليًا. ستُضاف هنا عند اعتماد إعدادات خاصة بها.
      </div>
    </Section>
  )
}

export function AzkarSection({
  azkarCounter,
  setAzkarCounter,
  journeyAutoAdvance,
  setJourneyAutoAdvance,
  toggle,
  save,
}: AzkarSectionProps) {
  const { confirm, alert } = useConfirmDialog()
  const [category, setCategory] = useState<AzkarSettingsCategory>('counter')

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={category === item.id}
            onClick={() => setCategory(item.id)}
            className={
              'u-pressable rounded-2xl border px-3 py-3 text-right ' +
              (category === item.id
                ? 'border-azkar-teal bg-azkar-teal-tint'
                : 'border-azkar-gold-soft bg-azkar-card')
            }
          >
            <span className="mb-1 flex items-center gap-2">
              <span className="text-sm text-azkar-teal-deep">{item.icon}</span>
              <b className="font-amiri text-sm text-azkar-teal-deep">{item.title}</b>
            </span>
            <span className="block text-[9px] leading-4 text-azkar-ink-soft">{item.description}</span>
          </button>
        ))}
      </div>

      {category === 'counter' && (
        <Section title="العداد والتقدم">
          <Row title="عداد الأذكار" description="إظهار زر العداد والتقدم داخل كل ذكر" last>
            <Toggle
              checked={azkarCounter}
              onChange={() =>
                toggle(APP_SETTINGS_KEYS.azkarCounterEnabled, setAzkarCounter, azkarCounter)
              }
              label="عداد الأذكار"
            />
          </Row>
        </Section>
      )}

      {category === 'journey' && (
        <Section title="رحلة الأذكار">
          <Row
            title="الانتقال التلقائي"
            description="الانتقال إلى الذكر التالي تلقائيًا بعد اكتمال العداد"
            last
          >
            <Toggle
              checked={journeyAutoAdvance}
              onChange={() =>
                toggle(
                  APP_SETTINGS_KEYS.journeyAutoAdvance,
                  setJourneyAutoAdvance,
                  journeyAutoAdvance,
                )
              }
              label="الانتقال التلقائي"
            />
          </Row>
        </Section>
      )}

      {category === 'data' && (
        <Section title="التقدم والبيانات">
          <Row
            title="تقدم اليوم"
            description="يمسح تقدم اليوم عند التأكيد، ولا يؤثر على الأيام السابقة"
            last
          >
            <button
              onClick={async () => {
                if (!(await confirm({ message: 'مسح تقدم أذكار اليوم؟', danger: true }))) return
                if (clearAzkarProgressDay()) {
                  window.dispatchEvent(new Event('azkar-settings-changed'))
                  await alert({ message: 'تم مسح تقدم اليوم.' })
                } else {
                  await alert({ message: 'تعذر مسح تقدم اليوم.' })
                }
              }}
              className="rounded-xl border border-red-200 px-3 py-2 text-[10px] font-bold text-red-600"
            >
              مسح تقدم اليوم
            </button>
          </Row>
        </Section>
      )}

      {category === 'reading' && <EmptyCategory title="تجربة القراءة" />}
      {category === 'interaction' && <EmptyCategory title="التفاعل" />}
    </div>
  )
}
