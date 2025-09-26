// Simple settings persistence for web (localStorage-based)
// Mirrors the Flutter Preferences behavior

const MICROPHONE_AUTO_STOP_KEY = 'polyglai.settings.microphoneAutoStop';
const SOUND_EFFECTS_ENABLED_KEY = 'polyglai_sound_effects';
const ANALYTICS_ENABLED_KEY = 'polyglai.settings.analyticsEnabled';
const CRASH_REPORTING_ENABLED_KEY = 'polyglai.settings.crashReportingEnabled';
const PERSONALIZED_ADS_ENABLED_KEY = 'polyglai.settings.personalizedAdsEnabled';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export const SettingsService = {
  async getMicrophoneAutoStop(): Promise<boolean> {
    try {
      if (!isBrowser()) return true; // default enabled on SSR
      const raw = localStorage.getItem(MICROPHONE_AUTO_STOP_KEY);
      if (raw == null) return true; // default enabled
      return raw === 'true';
    } catch {
      return true;
    }
  },

  async setMicrophoneAutoStop(value: boolean): Promise<void> {
    try {
      if (!isBrowser()) return;
      localStorage.setItem(MICROPHONE_AUTO_STOP_KEY, value ? 'true' : 'false');
    } catch {
      // ignore storage errors
    }
  },

  async getAnalyticsEnabled(): Promise<boolean> {
    try {
      if (!isBrowser()) return true; // default enabled
      const raw = localStorage.getItem(ANALYTICS_ENABLED_KEY);
      if (raw == null) return true;
      return raw === 'true';
    } catch {
      return true;
    }
  },

  async setAnalyticsEnabled(value: boolean): Promise<void> {
    try {
      if (!isBrowser()) return;
      localStorage.setItem(ANALYTICS_ENABLED_KEY, value ? 'true' : 'false');
    } catch {
      // ignore storage errors
    }
  },

  async getCrashReportingEnabled(): Promise<boolean> {
    try {
      if (!isBrowser()) return true; // default enabled
      const raw = localStorage.getItem(CRASH_REPORTING_ENABLED_KEY);
      if (raw == null) return true;
      return raw === 'true';
    } catch {
      return true;
    }
  },

  async setCrashReportingEnabled(value: boolean): Promise<void> {
    try {
      if (!isBrowser()) return;
      localStorage.setItem(CRASH_REPORTING_ENABLED_KEY, value ? 'true' : 'false');
    } catch {
      // ignore storage errors
    }
  },

  async getPersonalizedAdsEnabled(): Promise<boolean> {
    try {
      if (!isBrowser()) return false; // default disabled
      const raw = localStorage.getItem(PERSONALIZED_ADS_ENABLED_KEY);
      if (raw == null) return false;
      return raw === 'true';
    } catch {
      return false;
    }
  },

  async setPersonalizedAdsEnabled(value: boolean): Promise<void> {
    try {
      if (!isBrowser()) return;
      localStorage.setItem(PERSONALIZED_ADS_ENABLED_KEY, value ? 'true' : 'false');
    } catch {
      // ignore storage errors
    }
  },

  async getSoundEffectsEnabled(): Promise<boolean> {
    try {
      if (!isBrowser()) return true; // default enabled on SSR
      const raw = localStorage.getItem(SOUND_EFFECTS_ENABLED_KEY);
      if (raw == null) return true; // default enabled
      const parsed = JSON.parse(raw);
      return parsed === true;
    } catch {
      return true;
    }
  },

  async setSoundEffectsEnabled(value: boolean): Promise<void> {
    try {
      if (!isBrowser()) return;
      localStorage.setItem(SOUND_EFFECTS_ENABLED_KEY, JSON.stringify(value));
    } catch {
      // ignore storage errors
    }
  }
};


