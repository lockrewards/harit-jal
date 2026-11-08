export interface CookiePreferences {
  essential: boolean; // Always true
  functional: boolean;
  analytics: boolean;
  timestamp: string;
  hasConsented: boolean;
}

const COOKIE_STORAGE_KEY = 'harit_jal_cookie_consent_v1';

export class CookieConsentService {
  private static defaultPreferences: CookiePreferences = {
    essential: true,
    functional: true,
    analytics: true,
    timestamp: '',
    hasConsented: false,
  };

  /**
   * Read stored cookie preferences from localStorage
   */
  public static getPreferences(): CookiePreferences {
    try {
      const raw = localStorage.getItem(COOKIE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          essential: true,
          functional: parsed.functional ?? true,
          analytics: parsed.analytics ?? false,
          timestamp: parsed.timestamp || '',
          hasConsented: !!parsed.hasConsented,
        };
      }
    } catch (e) {
      console.warn('Failed to load cookie preferences', e);
    }
    return { ...this.defaultPreferences };
  }

  /**
   * Save customized cookie preferences
   */
  public static savePreferences(prefs: Partial<CookiePreferences>): CookiePreferences {
    const updated: CookiePreferences = {
      essential: true,
      functional: prefs.functional ?? true,
      analytics: prefs.analytics ?? false,
      timestamp: new Date().toISOString(),
      hasConsented: true,
    };

    try {
      localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(
        new CustomEvent('harit_jal_cookie_consent_updated', { detail: updated })
      );
    } catch (e) {
      console.error('Failed to save cookie consent', e);
    }

    return updated;
  }

  /**
   * Accept all cookie categories
   */
  public static acceptAll(): CookiePreferences {
    return this.savePreferences({
      functional: true,
      analytics: true,
    });
  }

  /**
   * Accept only strictly necessary cookies
   */
  public static acceptEssentialOnly(): CookiePreferences {
    return this.savePreferences({
      functional: false,
      analytics: false,
    });
  }

  /**
   * Check whether user has already made an affirmative choice
   */
  public static hasUserConsented(): boolean {
    return this.getPreferences().hasConsented;
  }

  /**
   * Reset consent (for testing or user request)
   */
  public static resetConsent(): void {
    try {
      localStorage.removeItem(COOKIE_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('harit_jal_cookie_consent_updated', { detail: null }));
    } catch (e) {
      console.error('Failed to reset cookie consent', e);
    }
  }
}

