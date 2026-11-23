import { Provider } from '@angular/core';
import {
  TranslateLoader,
  TranslationObject,
  provideTranslateLoader,
  provideTranslateService,
} from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import en from '../../../../public/i18n/en.json';

/** Serves the real English file synchronously, so specs can assert on the final text. */
class StaticEnglishLoader extends TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(en as TranslationObject);
  }
}

/**
 * Add to a spec's `providers` when the component's template uses the
 * `translate` pipe or the `roleName` pipe, or injects TranslateService.
 * English is active from the first render, no HTTP involved.
 */
export function provideTranslateTesting(): Provider[] {
  return provideTranslateService({
    loader: provideTranslateLoader(StaticEnglishLoader),
    lang: 'en',
    fallbackLang: 'en',
  });
}
