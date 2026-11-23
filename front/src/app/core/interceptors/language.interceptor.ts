import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LanguageService } from '../services/language.service';

/**
 * Tells the API which language to answer in. Every message in a response
 * body (toasts, validation issues) comes back already translated, so no
 * screen has to translate what the server says.
 */
export const languageInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api')) {
    return next(req);
  }

  const lang = inject(LanguageService).current();
  return next(req.clone({ setHeaders: { 'Accept-Language': lang } }));
};
