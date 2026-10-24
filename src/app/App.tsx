import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { surahList } from "../quran-meta";
const PrayerTimesView = lazy(() =>
  import("./features/prayer/PrayerTimesView").then((m) => ({
    default: m.PrayerTimesView,
  })),
);
const QiblaView = lazy(() =>
  import("./features/qibla/QiblaView").then((m) => ({
    default: m.QiblaView,
  })),
);
const ProphetsView = lazy(() =>
  import("./features/prophets/ProphetsView").then((m) => ({
    default: m.ProphetsView,
  })),
);
const HadithView = lazy(() =>
  import("./features/hadith/HadithView").then((m) => ({
    default: m.HadithView,
  })),
);
import { type View, type Section } from "./constants";
import { Splash } from "./components/app-chrome";
import { AppContent, BottomNav } from "./components/app-shell";
import { HomeView } from "./features/home/HomeView";
const AzkarListView = lazy(() =>
  import("./features/azkar/AzkarListView").then((m) => ({
    default: m.AzkarListView,
  })),
);
const CategoryView = lazy(() =>
  import("./features/azkar/CategoryView").then((m) => ({
    default: m.CategoryView,
  })),
);
const FavoritesView = lazy(() =>
  import("./features/azkar/FavoritesView").then((m) => ({
    default: m.FavoritesView,
  })),
);
const QuranReaderView = lazy(() =>
  import("./features/quran/QuranReaderView").then((m) => ({
    default: m.QuranReaderView,
  })),
);
import { QuranAudioProvider } from "./features/quran/QuranAudioProvider";
import { QuranMiniPlayer } from "./features/quran/QuranMiniPlayer";
const QuranListView = lazy(() =>
  import("./features/quran/QuranListView").then((m) => ({
    default: m.QuranListView,
  })),
);
import { useViewPersistence } from "./features/quran/useViewPersistence";
const TasbihView = lazy(() =>
  import("./features/tasbih/TasbihView").then((m) => ({
    default: m.TasbihView,
  })),
);
import { useTasbih } from "./features/tasbih/useTasbih";
import { useAzkarCatalog } from "./features/azkar/useAzkarCatalog";
import { useAzkarFeature } from "./features/azkar/useAzkarFeature";
const SettingsView = lazy(() =>
  import("./features/settings/SettingsView").then((m) => ({
    default: m.SettingsView,
  })),
);
import { useWakeLockSetting } from "./features/settings/useWakeLockSetting";
import { useAppearanceMode } from "./features/settings/useAppearanceMode";
import { useUiScaleSync } from "./features/settings/useUiScaleSync";
import { usePrayerReminders } from "./features/notifications/usePrayerReminders";
import { useIslamicNotifications } from "./features/notifications/useIslamicNotifications";
import { usePushSubscription } from "./features/notifications/pushSubscription";
import { useAppSounds } from "./features/sound/useAppSounds";
import { useTapSoundFeedback } from "./features/sound/useTapSoundFeedback";
import { APP_SETTINGS_KEYS, readSetting, writeSetting } from "./settings";

export function notificationOpenTarget(value: string | null): View | null {
  if (value === 'prayer') return { name: 'prayer-times' }
  if (value === 'azkar') return { name: 'azkar-list' }
  if (value === 'ayah') return { name: 'mushaf-list' }
  return null
}
function consumeNotificationOpen(): View | null {
  const url = new URL(window.location.href)
  const target = notificationOpenTarget(url.searchParams.get('open'))
  if (!target) return null
  url.searchParams.delete('open')
  window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : '') + url.hash)
  return target
}

export function AppLoadingFallback() {
  return (
    <main
      className="app-content startup-loading w-full min-w-0 max-w-md px-5"
      aria-live="polite"
      aria-label="جاري تحميل الشاشة"
    >
      <div className="startup-loading-card">
        <div className="startup-loading-indicator" aria-hidden="true">
          <span />
        </div>
        <span>جاري التحميل…</span>
      </div>
    </main>
  );
}

export function App() {
  const [booting, setBooting] = useState(true);
  const [splashExiting, setSplashExiting] = useState(false);
  const [view, setView] = useState<View>({ name: "home" });
  // In-app view history so the Android hardware back button can navigate
  // backwards instead of closing the app (native only, see effect below).
  const viewHistoryRef = useRef<View[]>([]);
  const lastViewRef = useRef<View>(view);
  useEffect(() => {
    if (lastViewRef.current === view) return;
    viewHistoryRef.current.push(lastViewRef.current);
    if (viewHistoryRef.current.length > 50) viewHistoryRef.current.shift();
    lastViewRef.current = view;
  }, [view]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cleanup = () => {};
    let cancelled = false;
    void (async () => {
      try {
        const { App: NativeApp } = await import("@capacitor/app");
        if (cancelled) return;
        const subscription = await NativeApp.addListener("backButton", () => {
          const previous = viewHistoryRef.current.pop();
          if (previous) {
            lastViewRef.current = previous;
            setView(previous);
          } else {
            void NativeApp.exitApp();
          }
        });
        if (cancelled) {
          void subscription.remove();
          return;
        }
        cleanup = () => void subscription.remove();
      } catch {
        // Native bridge unavailable; fall back to default behavior.
      }
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);
  const [mounted, setMounted] = useState(false);
  const [surahSearch, setSurahSearch] = useState("");
  const [, setSettingsVersion] = useState(0);
  const [lastSurah, setLastSurah] = useState<number | null>(null);
  const [navOrigin, setNavOrigin] = useState<"default" | "quick-tools">(
    "default",
  );
  const { categories, source } = useAzkarCatalog();
  const {
    counts,
    dayTotal,
    selectedWord,
    roundCounts,
    rounds,
    setSelectedWord,
    load: loadTasbih,
    tap,
    resetWord,
    resetToday,
  } = useTasbih();
  const {
    favorites,
    favoriteItems,
    selectedCategory,
    favoritesCount,
    toggleFavorite,
  } = useAzkarFeature(categories, view);

  usePrayerReminders();
  useIslamicNotifications();
  const { sync: syncPushSubscription } = usePushSubscription();
  useWakeLockSetting();
  const { tapFeedback } = useAppSounds();
  const { darkMode, appearance, setAppearance } = useAppearanceMode(mounted);
  useUiScaleSync();
  useTapSoundFeedback(tapFeedback);
  const readerView = useViewPersistence(view, setLastSurah);

  useEffect(() => {
    const target = consumeNotificationOpen()
    if (target) setView(target)
    const onNotificationClick = (event: MessageEvent) => {
      if (event.data?.type !== 'notification-click' || typeof event.data.url !== 'string') return
      const targetUrl = new URL(event.data.url, window.location.origin)
      const target = notificationOpenTarget(targetUrl.searchParams.get('open'))
      if (target) setView(target)
    }
    navigator.serviceWorker?.addEventListener('message', onNotificationClick)
    return () => navigator.serviceWorker?.removeEventListener('message', onNotificationClick)
  }, [])

  useEffect(() => {
    const refreshSettings = () => setSettingsVersion((v) => v + 1);
    window.addEventListener("azkar-settings-changed", refreshSettings);
    return () =>
      window.removeEventListener("azkar-settings-changed", refreshSettings);
  }, []);

  useEffect(() => {
    let syncing = false;
    const sync = () => {
      if (syncing) return;
      syncing = true;
      void syncPushSubscription().finally(() => {
        syncing = false;
      });
    };
    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "push-subscription-changed") sync();
    };
    window.addEventListener("azkar-settings-changed", sync);
    window.addEventListener("azkar-prayer-settings-changed", sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);
    sync();
    return () => {
      window.removeEventListener("azkar-settings-changed", sync);
      window.removeEventListener("azkar-prayer-settings-changed", sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
    };
  }, []);

  useEffect(() => {
    setMounted(true);
    const startedAt = performance.now();
    let painted = false;
    let fontsReady = false;
    let cancelled = false;
    let exitTimer = 0;
    const finishSplash = () => {
      if (cancelled || !painted || !fontsReady) return;
      const wait = Math.max(0, 350 - (performance.now() - startedAt));
      window.setTimeout(() => {
        if (cancelled) return;
        setSplashExiting(true);
        exitTimer = window.setTimeout(() => setBooting(false), 350);
      }, wait);
    };
    const fonts = document.fonts?.ready
      ? Promise.race([
          document.fonts.ready,
          new Promise((resolve) => window.setTimeout(resolve, 1500)),
        ])
      : Promise.resolve();
    fonts.finally(() => {
      fontsReady = true;
      finishSplash();
    });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        painted = true;
        finishSplash();
      }),
    );
    const hardStop = window.setTimeout(() => {
      if (cancelled) return;
      setSplashExiting(true);
      exitTimer = window.setTimeout(() => setBooting(false), 350);
    }, 2150);
    try {
      const savedLastSurah = localStorage.getItem("azkar_last_surah");
      if (savedLastSurah) setLastSurah(parseInt(savedLastSurah, 10) || null);
      loadTasbih();
      if (readSetting(APP_SETTINGS_KEYS.restoreLastPage, "0") === "1") {
        const savedView = localStorage.getItem("azkar_last_view");
        if (savedView === "prayer-times") setView({ name: "prayer-times" });
        else if (savedView === "mushaf-list") setView({ name: "mushaf-list" });
        else if (savedView === "azkar-list") setView({ name: "azkar-list" });
        else if (savedView === "tasbih") setView({ name: "tasbih" });
      }
    } catch {}
    const idle = (callback: () => void, timeout = 1800) => {
      if ("requestIdleCallback" in window) {
        const id = window.requestIdleCallback(callback, { timeout });
        return () => window.cancelIdleCallback(id);
      }
      const id = globalThis.setTimeout(callback, Math.min(timeout, 1200));
      return () => window.clearTimeout(id);
    };
    const prefetchScreens = () =>
      Promise.allSettled([
        import("./features/settings/SettingsView"),
        import("./features/azkar/AzkarListView"),
        import("./features/azkar/CategoryView"),
        import("./features/azkar/FavoritesView"),
        import("./features/quran/QuranReaderView"),
        import("./features/quran/QuranListView"),
        import("./features/prayer/PrayerTimesView"),
        import("./features/qibla/QiblaView"),
        import("./features/prophets/ProphetsView"),
        import("./features/hadith/HadithView"),
        import("./features/tasbih/TasbihView"),
      ]);
    const waitForServiceWorkerControl = async () => {
      // Inside the native Android shell the WebView cache already serves the
      // bundled app; a service worker would pin a stale copy over APK updates.
      if (Capacitor.isNativePlatform()) return false;
      if (!("serviceWorker" in navigator)) return false;
      try {
        await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        if (navigator.serviceWorker.controller) return true;
        await new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            navigator.serviceWorker.removeEventListener(
              "controllerchange",
              finish,
            );
            resolve();
          };
          navigator.serviceWorker.addEventListener("controllerchange", finish, {
            once: true,
          });
          window.setTimeout(finish, 2500);
        });
        return Boolean(navigator.serviceWorker.controller);
      } catch {
        return false;
      }
    };
    const cancelPrefetch = idle(() => {
      void waitForServiceWorkerControl().then((controlled) => {
        if (!cancelled && controlled) void prefetchScreens();
      });
    }, 2200);
    return () => {
      cancelled = true;
      window.clearTimeout(hardStop);
      window.clearTimeout(exitTimer);
      cancelPrefetch();
    };
  }, [loadTasbih]);

  const go = (s: Section) => {
    setNavOrigin("default");
    setView(
      s === "home"
        ? { name: "home" }
        : s === "mushaf"
          ? { name: "mushaf-list" }
          : s === "hadith"
            ? { name: "hadith" }
            : s === "azkar"
              ? { name: "azkar-list" }
              : s === "tasbih"
                ? { name: "tasbih" }
                : { name: "settings" },
    );
  };
  // Quick Tools entries return straight to Home; bottom-nav and dashboard
  // entries keep their normal back destinations.
  const goView = (v: View) => {
    setNavOrigin("default");
    setView(v);
  };
  const backTo = navOrigin === "quick-tools" ? () => setView({ name: "home" }) : null;
  const quickOrigin = navOrigin === "quick-tools";
  const lastSurahMeta = lastSurah
    ? surahList.find((s) => s.number === lastSurah)
    : undefined;

  return (
    <QuranAudioProvider setView={setView}>
      <div
        dir="rtl"
        className="app-viewport min-h-[100dvh] w-full min-w-0 flex flex-col items-center overflow-x-hidden font-['Cairo',sans-serif] text-azkar-ink"
        style={{
          background:
            "radial-gradient(ellipse 120% 60% at 50% -10%, hsl(var(--hero-a)), transparent), radial-gradient(ellipse 100% 50% at 100% 100%, hsl(var(--hero-b)), transparent), hsl(var(--azkar-bg))",
        }}
      >
        {booting && <Splash exiting={splashExiting} />}
        <Suspense fallback={<AppLoadingFallback />}>
          <AppContent
            view={view}
            home={
              <HomeView
                dayTotal={dayTotal}
                lastSurahMeta={lastSurahMeta}
                darkMode={darkMode}
                onToggleDarkMode={() =>
                  setAppearance(darkMode ? "light" : "dark")
                }
                onOpenPrayer={() => setView({ name: "prayer-times" })}
                onOpenMushaf={() => setView({ name: "mushaf-list" })}
                onOpenAzkar={() => setView({ name: "azkar-list" })}
                onOpenMorningAzkar={() => {
                  setNavOrigin("quick-tools");
                  setView({ name: "category", id: "morning" });
                }}
                onOpenEveningAzkar={() => {
                  setNavOrigin("quick-tools");
                  setView({ name: "category", id: "evening" });
                }}
                onOpenTasbih={() => setView({ name: "tasbih" })}
                onContinueReading={() =>
                  lastSurahMeta
                    ? (setNavOrigin("quick-tools"),
                      setView({
                        name: "mushaf-surah",
                        number: lastSurahMeta.number,
                      }))
                    : (setNavOrigin("quick-tools"),
                      setView({ name: "mushaf-list" }))
                }
                onOpenSettings={() => setView({ name: "settings" })}
                onOpenQibla={() => setView({ name: "qibla" })}
                onOpenProphets={() => setView({ name: "prophets" })}
                onOpenHadith={() => setView({ name: "hadith" })}
                onOpenFavorites={() => {
                  setNavOrigin("quick-tools");
                  setView({ name: "favorites" });
                }}
              />
            }
            settings={
              <SettingsView
                darkMode={darkMode}
                appearance={appearance}
                onAppearance={setAppearance}
                onBack={() => setView({ name: "home" })}
              />
            }
            azkarList={
              <AzkarListView
                categories={categories}
                source={source}
                favoritesCount={favoritesCount}
                onBack={() => setView({ name: "home" })}
                setView={setView}
              />
            }
            favorites={
              <FavoritesView
                favorites={favoriteItems}
                onToggleFavorite={toggleFavorite}
                onBack={backTo ?? (() => setView({ name: "azkar-list" }))}
                setView={setView}
              />
            }
            category={
              selectedCategory ? (
                <CategoryView
                  category={selectedCategory}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                  onBack={
                    quickOrigin
                      ? () => setView({ name: "home" })
                      : () => setView({ name: "azkar-list" })
                  }
                />
              ) : null
            }
            mushafList={
              <QuranListView
                lastSurah={lastSurah}
                surahSearch={surahSearch}
                setSurahSearch={setSurahSearch}
                setView={goView}
              />
            }
            mushafReader={
              readerView ? (
                <QuranReaderView
                  view={readerView}
                  setView={
                    quickOrigin
                      ? (v) => {
                          if (v.name === "mushaf-list" || v.name === "home") {
                            setView({ name: "home" });
                            setNavOrigin("default");
                          } else {
                            setView(v);
                          }
                        }
                      : setView
                  }
                />
              ) : null
            }
            mushafReaderActive={view.name === "mushaf-surah"}
            prayer={
              <PrayerTimesView
                onBack={() => setView({ name: "home" })}
                onOpenQibla={() => setView({ name: "qibla" })}
              />
            }
            qibla={
              <QiblaView onBack={() => setView({ name: "home" })} />
            }
            prophets={
              <ProphetsView onBack={() => setView({ name: "home" })} />
            }
            hadith={
              <HadithView onBack={() => setView({ name: "home" })} />
            }
            onHome={() => setView({ name: "home" })}
            tasbih={
              <TasbihView
                counts={counts}
                dayTotal={dayTotal}
                selectedWord={selectedWord}
                roundCounts={roundCounts}
                rounds={rounds}
                onTap={tap}
                onResetWord={resetWord}
                onResetToday={resetToday}
                onSelectWord={setSelectedWord}
                setView={setView}
              />
            }
          />
        </Suspense>
        {view.name !== "mushaf-surah" && <QuranMiniPlayer />}
        {view.name !== "mushaf-surah" && (
          <BottomNav view={view} onNavigate={go} />
        )}
      </div>
    </QuranAudioProvider>
  );
}
