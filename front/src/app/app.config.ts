import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideHotToastConfig } from '@ngxpert/hot-toast';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { languageInterceptor } from './core/interceptors/language.interceptor';
import { FALLBACK_LANGUAGE } from './core/i18n/languages';
import { LanguageService } from './core/services/language.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([languageInterceptor, authInterceptor])),
    // UI text comes from public/i18n/<lang>.json. The initial language is
    // loaded before the first render, so raw keys never flash on screen.
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
      fallbackLang: FALLBACK_LANGUAGE,
    }),
    provideAppInitializer(() => inject(LanguageService).init()),
    // Defaults for every toast fired through <app-toast>.
    provideHotToastConfig({ position: 'top-right', duration: 4000, dismissible: true }),
  ],
};
