import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));


  // main.ts (or before editor is created)
(window as any).MonacoEnvironment = {
  getWorkerUrl: function (_moduleId: string, label: string) {
    const base = `${window.location.origin}${document.baseURI.replace(window.location.origin, '')}`;
    // If baseURI ends with '/', base is fine. Otherwise ensure trailing slash.
    const baseUrl = base.endsWith('/') ? base : base + '/';

    if (label === 'typescript' || label === 'javascript') {
      return baseUrl + 'assets/monaco/min/vs/language/typescript/tsWorker.js';
    }
    return baseUrl + 'assets/monaco/min/vs/base/worker/workerMain.js';
  }
};
