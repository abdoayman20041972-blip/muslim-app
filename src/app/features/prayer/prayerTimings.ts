import { useEffect, useMemo, useState } from 'react'
import { currentMethod, currentSchool, dateKey, REQUIRED_TIMINGS } from './prayerTimes'
import { normalizeCoords } from './prayerCoords'
import type { Coords, Timings } from './prayerTimes'

const API='https://api.aladhan.com/v1'
const MAX_CACHE_AGE=3*24*60*60*1000
const TIME_RE=/^\d{1,2}:\d{2}/

function cacheKey(date:Date,c:Coords,method=currentMethod(),school=currentSchool()){
  return `azkar_pt_v2_${dateKey(date)}_${c.lat.toFixed(2)}_${c.lng.toFixed(2)}_m${method}_s${school}`
}
function monthCacheKey(date:Date,c:Coords,method=currentMethod(),school=currentSchool()){
  return `azkar_pt_month_v2_${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}_${c.lat.toFixed(2)}_${c.lng.toFixed(2)}_m${method}_s${school}`
}
function validTimings(value:unknown):value is Timings{
  if(!value||typeof value!=='object')return false
  const t=value as Record<string,unknown>
  return REQUIRED_TIMINGS.every(k=>typeof t[k]==='string'&&TIME_RE.test(t[k] as string))
}
function tz(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch{return ''}}
function store(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),value}))}catch{}}
function read(key:string):unknown{
  try{
    const raw=localStorage.getItem(key);if(!raw)return null
    const parsed=JSON.parse(raw)
    if(parsed?.savedAt&&Date.now()-Number(parsed.savedAt)>MAX_CACHE_AGE){localStorage.removeItem(key);return null}
    return parsed?.value??parsed
  }catch{return null}
}
function storeDay(date:Date,c:Coords,t:Timings,method=currentMethod(),school=currentSchool()){store(cacheKey(date,c,method,school),t)}
type PrayerMonthResponse={data?:Record<string,{date?:{gregorian?:{day?:unknown}};timings?:unknown}>}
function extractMonth(json:unknown):Map<number,Timings>{
  const out=new Map<number,Timings>()
  const data=(json as PrayerMonthResponse|undefined)?.data??{}
  for(const item of Object.values(data)){
    const d=Number(item?.date?.gregorian?.day)
    const t=item?.timings
    if(Number.isInteger(d)&&validTimings(t))out.set(d,t)
  }
  return out
}
async function fetchMonth(c:Coords,date:Date,method=currentMethod(),school=currentSchool(),signal?:AbortSignal):Promise<Map<number,Timings>>{
  const cached=read(monthCacheKey(date,c,method,school))
  if(cached&&typeof cached==='object'){
    const map=extractMonth({data:cached})
    if(map.size)return map
  }
  const y=date.getFullYear(),m=date.getMonth()+1
  const qs=new URLSearchParams({latitude:String(c.lat),longitude:String(c.lng),method,school,timezonestring:tz()})
  const res=await fetch(`${API}/calendar/${y}/${m}?${qs}`,{signal})
  if(!res.ok)throw Error('prayer-api')
  const json=await res.json()
  const map=extractMonth(json)
  if(map.size===0)throw Error('invalid-prayer-api')
  store(monthCacheKey(date,c,method,school),json.data)
  return map
}
export async function getTimings(coords:Coords,date:Date,options:{signal?:AbortSignal}={}):Promise<Timings|null>{
  const c=normalizeCoords(coords);if(!c)return null
  const method=currentMethod(),school=currentSchool(),key=cacheKey(date,c,method,school)
  const cached=read(key)
  if(validTimings(cached))return cached
  const map=await fetchMonth(c,date,method,school,options.signal)
  const t=map.get(date.getDate())
  if(!t||!validTimings(t))return null
  storeDay(date,c,t,method,school)
  return t
}
export function cleanupPrayerCache(){
  try{
    for(let i=localStorage.length-1;i>=0;i--){
      const k=localStorage.key(i)
      if(!k)continue
      if(k.startsWith('azkar_prayer_timings_'))localStorage.removeItem(k)
      else if(k.startsWith('azkar_pt_v2_')||k.startsWith('azkar_pt_month_v2_')){
        const raw=localStorage.getItem(k)
        try{const p=JSON.parse(raw||'');if(p?.savedAt&&Date.now()-Number(p.savedAt)>MAX_CACHE_AGE)localStorage.removeItem(k)}catch{localStorage.removeItem(k)}
      }
    }
  }catch{}
}
export function usePrayerTimings(coords:Coords|null){
  const dayKey=useMemo(()=>dateKey(new Date()),[new Date().getFullYear(),new Date().getMonth(),new Date().getDate()])
  const [timings,setTimings]=useState<Timings|null>(null)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState<string|null>(null)
  useEffect(()=>{cleanupPrayerCache();if(!coords){setTimings(null);return}
    let cancelled=false
    const controller=new AbortController()
    setLoading(true);setError(null)
    getTimings(coords,new Date(),{signal:controller.signal}).then(t=>{if(!cancelled)setTimings(t);if(!t&&!cancelled)setError('تعذر الحصول على مواقيت الصلاة. تحقق من الاتصال أو حدّث الموقع.')}).catch(()=>{if(!cancelled){setError('تعذر الحصول على مواقيت الصلاة. تحقق من الاتصال أو حدّث الموقع.');setTimings(null)}}).finally(()=>{if(!cancelled)setLoading(false)})
    return()=>{cancelled=true;controller.abort()}
  },[coords?.lat,coords?.lng,dayKey,currentMethod(),currentSchool()])
  return {timings,loading,error,dayKey}
}
