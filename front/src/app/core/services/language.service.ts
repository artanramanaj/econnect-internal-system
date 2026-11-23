import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_LANGUAGE,
  INTL_LOCALES,
  Language,
  isLanguage,
} from '../i18n/languages';
import { AuthService } from './auth.service';

/** Where the choice made on this device is kept, so a reload keeps the language. */
const STORAGE_KEY = 'econnect.language';

function readStored(): Language | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStored(lang: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Private mode or blocked storage: the choice just does not survive a reload.
  }
}

/**
 * The UI language.
 *
 * Three places remember it, in this order of precedence:
 *   1. the choice made on this device (localStorage), so the login screen can
 *      already be in your language and so a reload does not reset it;
 *   2. the account's `locale`, adopted when this device has no choice yet
 *      (first visit here), and updated whenever the device choice differs;
 *   3. the app default.
 *
 * The device choice wins over the account so that picking English on the
 * login page is not undone by the sign-in that follows.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private translate = inject(TranslateService);
  private auth = inject(AuthService);
  private document = inject(DOCUMENT);

  private readonly _current = signal<Language>(readStored() ?? DEFAULT_LANGUAGE);

  /** The language the UI is rendered in. Changes once the new translations have loaded. */
  readonly current = this._current.asReadonly();

  /** BCP 47 tag for `toLocaleDateString` and friends. */
  readonly locale = computed(() => INTL_LOCALES[this._current()]);

  constructor() {
    effect(() => {
      const user = this.auth.currentUser();
      if (!user || !isLanguage(user.locale)) return;

      const chosen = readStored();
      if (chosen === null) {
        void this.adopt(user.locale);
      } else if (chosen !== user.locale) {
        this.syncAccount(chosen);
      }
    });
  }

  /** Loads the initial language. Awaited by the app initializer so raw keys never flash. */
  init(): Promise<void> {
    return this.apply(this._current());
  }

  /** Switch the UI language and remember it on this device and on the account. */
  async use(lang: Language): Promise<void> {
    await this.adopt(lang);
    if (this.auth.isAuthenticated()) {
      this.syncAccount(lang);
    }
  }

  private async adopt(lang: Language): Promise<void> {
    await this.apply(lang);
    writeStored(lang);
  }

  private async apply(lang: Language): Promise<void> {
    await firstValueFrom(this.translate.use(lang));
    this._current.set(lang);
    this.document.documentElement.lang = lang;
  }

  /** Fire and forget: a failed save only means the next device starts in the old language. */
  private syncAccount(lang: Language): void {
    this.auth.updateLocale(lang).subscribe({ error: () => undefined });
  }
}
