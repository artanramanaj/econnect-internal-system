import { Component, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Language, SUPPORTED_LANGUAGES } from '../../../core/i18n/languages';
import { LanguageService } from '../../../core/services/language.service';

/** SQ | EN toggle. Lives in the sidebar and on the public auth screens. */
@Component({
  selector: 'app-language-switcher',
  imports: [TranslatePipe],
  templateUrl: './language-switcher.html',
})
export class LanguageSwitcher {
  /** `dark` for the navy sidebar, `light` for white pages. */
  readonly tone = input<'dark' | 'light'>('light');

  private language = inject(LanguageService);

  readonly languages = SUPPORTED_LANGUAGES;
  readonly current = this.language.current;

  select(lang: Language): void {
    void this.language.use(lang);
  }

  groupClass(): string {
    return this.tone() === 'dark' ? 'border-white/20' : 'border-card-border bg-white';
  }

  buttonClass(lang: Language): string {
    const active = lang === this.current();
    if (this.tone() === 'dark') {
      return active ? 'bg-white/15 text-white' : 'text-sidebar-muted hover:text-white';
    }
    return active ? 'bg-primary text-dark-blue' : 'text-muted hover:text-dark-blue';
  }
}
