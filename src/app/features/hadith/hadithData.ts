export type Hadith = {
  id: string
  text: string
  source: string
  note: string
}

// Curated, well-established hadiths with primary collection references.
// These work fully offline. Extended collections load on demand from the
// open hadith-api dataset (fawazahmed0/hadith-api via jsDelivr).
export const HADITH_COLLECTION: Hadith[] = [
  {
    id: 'bukhari-1',
    text: 'إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى',
    source: 'صحيح البخاري — ١',
    note: 'النية تصحّح العمل وتحوّله عبادةً لله، فمن عمل لدنيا لا شيء له إلا ما نوى.',
  },
  {
    id: 'muslim-55a',
    text: 'الدين النصيحة',
    source: 'صحيح مسلم — ٥٥',
    note: 'النصيحة لله ولكتابه ورسوله ولأئمة المسلمين وعامتهم أساس هذا الدين.',
  },
  {
    id: 'bukhari-10',
    text: 'المسلم من سلم المسلمون من لسانه ويده',
    source: 'صحيح البخاري — ١٠',
    note: 'الإيمان عملٌ يظهر في لسانك لا تجريحًا، ويديك لا ظلمًا.',
  },
  {
    id: 'bukhari-13',
    text: 'لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه',
    source: 'صحيح البخاري — ١٣',
    note: 'كمال الإيمان أن تتمنى الخير لأخيك كما تتمناه لنفسك.',
  },
  {
    id: 'tirmidhi-2317',
    text: 'من حسن إسلام المرء تركه ما لا يعنيه',
    source: 'سنن الترمذي — ٢٣١٧',
    note: 'من كمال المسلم أن يترك الحديث والعمل الذي لا ينفعه لا ساعة ضياع.',
  },
  {
    id: 'muslim-101',
    text: 'من غشنا فليس منا',
    source: 'صحيح مسلم — ١٠١',
    note: 'النص والعمل واحدهما، فلا فرق بين العبادة والمعاملة في الأمانة.',
  },
  {
    id: 'bukhari-52',
    text: 'الحلال بيّن والحرام بيّن، وبينهما مشتبهات',
    source: 'صحيح البخاري — ٥٢',
    note: 'من اتّقى الشبهات استبرأ دينه وعرضه، ومن وقع فيها وقع في الحرام.',
  },
  {
    id: 'tirmidhi-2516',
    text: 'اتق الله حيثما كنت، وأتبع السيئة الحسنة تمحها، وخالق الناس بخُلُقٍ حسن',
    source: 'سنن الترمذي — ٢٥١٦',
    note: 'وصيةٌ جامعة: تقوى، ثم توبة بعد خطيئة، ثم معاملة الناس بحسن الخلق.',
  },
  {
    id: 'bukhari-6682',
    text: 'كلمتان خفيفتان على اللسان، ثقيلتان في الميزان، حبيبتان إلى الرحمن: سبحان الله وبحمده، سبحان الله العظيم',
    source: 'صحيح البخاري — ٦٦٨٢',
    note: 'أغلب الأجر في الكلمات التي لا تكلفك شيئًا، فأكثر منها.',
  },
  {
    id: 'bukhari-6436',
    text: 'أحبّ الأعمال إلى الله أدومُها وإن قلّ',
    source: 'صحيح البخاري — ٦٤٣٦',
    note: 'الاستمرار على العمل القليل خيرٌ من الحثيث المنقطع، فكن ثابتًا لا مستعجلًا.',
  },
  {
    id: 'bukhari-6168',
    text: 'المرء مع من أحبّ',
    source: 'صحيح البخاري — ٦١٦٨',
    note: 'فاختر جليسك، فإنّ الصحبة تدبّ إلى القلب تدريجًا.',
  },
  {
    id: 'muslim-2664',
    text: 'المؤمن القويّ خيرٌ وأحبّ إلى الله من المؤمن الضعيف، وفي كلٍّ خير',
    source: 'صحيح مسلم — ٢٦٦٤',
    note: 'القوة هنا بالإيمان والعزم والعمل، فاحرص على قلبٍ قويّ وجسدٍ صالح.',
  },
  {
    id: 'muslim-2699',
    text: 'من سلك طريقًا يلتمس فيه علمًا سهّل الله له به طريقًا إلى الجنة',
    source: 'صحيح مسلم — ٢٦٩٩',
    note: 'طلب العلم عبادةٌ تفتح أبواب الجنة، فاعزم ولو خطوة.',
  },
  {
    id: 'muslim-54',
    text: 'لا تدخلون الجنة حتى تؤمنوا، ولا تؤمنوا حتى تحابّوا، أوَلا أدلّكم على شيءٍ إذا فعلتموه تحاببتم؟ أفشوا السلام بينكم',
    source: 'صحيح مسلم — ٥٤',
    note: 'السلام مفتاح المحبة، والمحبة إيمان، والإيمان مدخل الجنة.',
  },
  {
    id: 'muslim-2627',
    text: 'لا تحقرنّ من المعروف شيئًا، ولو أن تلقى أخاك بوجهٍ طلْق',
    source: 'صحيح مسلم — ٢٦٢٧',
    note: 'ابتسامتك لأخيك صدقة، فلا تستصغر معروفًا صغيرًا.',
  },
  {
    id: 'muslim-223',
    text: 'الطُّهور شطر الإيمان',
    source: 'صحيح مسلم — ٢٢٣',
    note: 'النظافة والطهارة نصف الإيمان، ظاهرًا للبدن وباطنًا للقلب.',
  },
  {
    id: 'bukhari-69',
    text: 'يسّروا ولا تعسّروا، وبشّروا ولا تنفّروا',
    source: 'صحيح البخاري — ٦٩',
    note: 'أصل الدعوة والتعليم: التيسير والبشارة لا التثقيل والنفور.',
  },
  {
    id: 'bukhari-6018',
    text: 'من كان يؤمن بالله واليوم الآخر فليقل خيرًا أو ليصمت',
    source: 'صحيح البخاري — ٦٠١٨',
    note: 'حفظ اللسان علامة إيمانٍ صادق، فقل خيرًا أو اسكت.',
  },
  {
    id: 'muslim-2578',
    text: 'اتقوا الظلم فإنّ الظلم ظلماتٌ يوم القيامة',
    source: 'صحيح مسلم — ٢٥٧٨',
    note: 'الظلم يظلم صاحبه أولًا، فاحذر أن تظلم وأنت الغالب.',
  },
  {
    id: 'tirmidhi-3895',
    text: 'خيرُكم خيرُكم لأهله، وأنا خيرُكم لأهلي',
    source: 'سنن الترمذي — ٣٨٩٥',
    note: 'خير الرجال من أحسن إلى أهله، فالبيت أول ميدان للإحسان.',
  },
]

export type ApiEdition = {
  key: string
  edition: string
  name: string
  blurb: string
}

// Small Arabic editions from the open hadith-api dataset (fawazahmed0/hadith-api, CC0-like open data).
// These are fetched on demand from jsDelivr and cached in the session.
export const API_EDITIONS: ApiEdition[] = [
  {
    key: 'nawawi',
    edition: 'ara-nawawi',
    name: 'الأربعون النووية',
    blurb: 'أربعون حديثًا جمعها الإمام النووي، تدور على أصول الدين والأخلاق.',
  },
  {
    key: 'qudsi',
    edition: 'ara-qudsi',
    name: 'الأربعون القدسية',
    blurb: 'أربعون حديثًا قدسيًّا يُروى فيها عن الله تعالى بمعناه.',
  },
  {
    key: 'dehlawi',
    edition: 'ara-dehlawi',
    name: 'أربعون حديثًا لشاه ولي الله',
    blurb: 'أربعون حديثًا مختارة من جامعها شاه ولي الله الدهلوي.',
  },
]

export const HADITH_API_BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions'

export type ApiHadith = { hadithnumber: string | number; text: string }
export type ApiEditionData = { hadiths: ApiHadith[] }

const editionCache = new Map<string, ApiEditionData>()

export async function loadApiEdition(edition: string): Promise<ApiEditionData> {
  const cached = editionCache.get(edition)
  if (cached) return cached
  const storageKey = `hadith-edition:${edition}`
  try {
    const stored = sessionStorage.getItem(storageKey)
    if (stored) {
      const parsed = JSON.parse(stored) as ApiEditionData
      editionCache.set(edition, parsed)
      return parsed
    }
  } catch {
    // sessionStorage unavailable; fall through to network
  }
  const response = await fetch(`${HADITH_API_BASE}/${edition}.min.json`)
  if (!response.ok) throw new Error(`فشل تحميل الحديث (${response.status})`)
  const data = (await response.json()) as ApiEditionData
  if (!Array.isArray(data.hadiths)) throw new Error('بيانات غير صالحة')
  editionCache.set(edition, data)
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(data))
  } catch {
    // quota or private mode; memory cache still works
  }
  return data
}
