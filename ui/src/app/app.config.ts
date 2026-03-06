import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode, provideZonelessChangeDetection, provideZoneChangeDetection } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideServiceWorker('custom-service-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
    provideHttpClient(withInterceptorsFromDi()),
  ]
};
