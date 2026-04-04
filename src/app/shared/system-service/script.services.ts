import { Injectable } from '@angular/core';
import { Constants } from 'src/app/system-files/constants';
import { ProcessType } from 'src/app/system-files/system.types';
import { ProcessIDService } from './process.id.service';
import { RunningProcessService } from './running.process.service';
import { Process } from 'src/app/system-files/process';
import { Service } from 'src/app/system-files/service';
import { BaseService } from './base.service.interface';

interface Asset {
  name: string;
  src: string;
}

interface AssetMap {
  [key: string]: Asset;
}

@Injectable({
  providedIn: 'root'
})
export class ScriptService implements BaseService {
  private _runningProcessService!: RunningProcessService;
  private _processIdService!: ProcessIDService;

  /**
   * Tracks successfully requested assets by logical name.
   * Kept for backward compatibility with your current approach.
   */
  private scripts: AssetMap = {};
  private styles: AssetMap = {};

  /**
   * Tracks in-flight requests so duplicate concurrent calls
   * return the same Promise instead of inserting duplicate tags.
   */
  private loadingScripts = new Map<string, Promise<void>>();
  private loadingStyles = new Map<string, Promise<void>>();

  name = 'scripts_svc';
  icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
  processId = 0;
  type = ProcessType.Cheetah;
  status = Constants.SERVICES_STATE_RUNNING;
  hasWindow = false;
  description = 'handles loading of js scripts and css assets';

  constructor( processIDService: ProcessIDService, runningProcessService: RunningProcessService) {
    this._processIdService = processIDService;
    this._runningProcessService = runningProcessService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getProcessDetail());
    this._runningProcessService.addService(this.getServiceDetail());
  }

  /**
   * Loads a single external JS script on demand.
   * Non-breaking: keeps the same method name/signature.
   */
  async loadScript(name: string, src: string, isModule = true): Promise<void> {
    const key = this.buildAssetKey(name, src);

    if (this.isScriptAlreadyLoaded(name, src)) {
      this.scripts[name] = { name, src };
      return Promise.resolve();
    }

    const isLoadingInProgress = this.loadingScripts.get(key);
    if(isLoadingInProgress){
      return isLoadingInProgress;
    }

    const script: Asset = { name, src };
    const promise = this.loadExternalScript(script, isModule)
      .then(() => {
        this.scripts[name] = script;
      })
      .catch((error) => {
        delete this.scripts[name];
        throw error;
      })
      .finally(() => {
        this.loadingScripts.delete(key);
      });

    this.loadingScripts.set(key, promise);
    return promise;
  }

  /**
   * Loads multiple JS scripts on demand.
   * Fixes the old bug where the method did not truly await the batch.
   */
  async loadScripts(names: string[], srcs: string[], isModule = true): Promise<void> {
    if (names.length !== srcs.length) {
      throw new Error('loadScripts: names and srcs must have the same length.');
    }

    const promises: Promise<void>[] = [];

    for (let i = 0; i < names.length; i++) {
      promises.push(this.loadScript(names[i], srcs[i], isModule));
    }

    await Promise.all(promises);
  }

  /**
   * Loads a single CSS file on demand.
   */
  async loadStyle(name: string, href: string): Promise<void> {
    const key = this.buildAssetKey(name, href);

    if (this.isStyleAlreadyLoaded(name, href)) {
      this.styles[name] = { name, src: href };
      return Promise.resolve();
    }

    const isLoadingInProgress = this.loadingStyles.get(key);
    if(isLoadingInProgress){
      return isLoadingInProgress;
    }

    const style: Asset = { name, src: href };
    const promise = this.loadExternalStyle(style)
      .then(() => {
        this.styles[name] = style;
      })
      .catch((error) => {
        delete this.styles[name];
        throw error;
      })
      .finally(() => {
        this.loadingStyles.delete(key);
      });

    this.loadingStyles.set(key, promise);
    return promise;
  }

  /**
   * Loads multiple CSS files on demand.
   */
  async loadStyles(names: string[], hrefs: string[]): Promise<void> {
    if (names.length !== hrefs.length) {
      throw new Error('loadStyles: names and hrefs must have the same length.');
    }

    const promises: Promise<void>[] = [];

    for (let i = 0; i < names.length; i++) {
      promises.push(this.loadStyle(names[i], hrefs[i]));
    }

    await Promise.all(promises);
  }

  /**
   * Optional convenience method if you want one call site
   * for both script and style asset types.
   */
  async loadAsset(
    type: 'script' | 'style',
    name: string,
    url: string,
    isModule = true
  ): Promise<void> {
    if (type === 'script') {
      return this.loadScript(name, url, isModule);
    }

    return this.loadStyle(name, url);
  }

  private async loadExternalScript(script: Asset, isModule: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = this.findExistingScript(script.src);
      if(existing){
        resolve();
        return;
      }

      const scriptElement = document.createElement('script');
      scriptElement.src = script.src;
      scriptElement.async = true;
      scriptElement.type = isModule ? 'module' : 'text/javascript';
      scriptElement.setAttribute('data-asset-name', script.name);

      scriptElement.onload = () => resolve();
      scriptElement.onerror = () => {
        scriptElement.remove();
        reject(new Error(`Failed to load script: ${script.src}`));
      };

      document.head.appendChild(scriptElement);
    });
  }

  private async loadExternalStyle(style: Asset): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = this.findExistingStyle(style.src);
      if (existing) {
        resolve();
        return;
      }

      const linkElement = document.createElement('link');
      linkElement.rel = 'stylesheet';
      linkElement.href = style.src;
      linkElement.setAttribute('data-asset-name', style.name);

      linkElement.onload = () => resolve();
      linkElement.onerror = () => {
        linkElement.remove();
        reject(new Error(`Failed to load stylesheet: ${style.src}`));
      };

      document.head.appendChild(linkElement);
    });
  }

  private isScriptAlreadyLoaded(name: string, src: string): boolean {
    return !!this.scripts[name] || !!this.findExistingScript(src);
  }

  private isStyleAlreadyLoaded(name: string, href: string): boolean {
    return !!this.styles[name] || !!this.findExistingStyle(href);
  }

  private findExistingScript(src: string): HTMLScriptElement | null {
    return document.querySelector(`script[src="${this.escapeAttributeValue(src)}"]`);
  }

  private findExistingStyle(href: string): HTMLLinkElement | null {
    return document.querySelector(`link[rel="stylesheet"][href="${this.escapeAttributeValue(href)}"]`);
  }

  private buildAssetKey(name: string, src: string): string {
    return `${name}::${src}`;
  }

  private escapeAttributeValue(value: string): string {
    return value.replace(/"/g, '\\"');
  }

  private getProcessDetail(): Process {
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
  }

  private getServiceDetail(): Service {
    return new Service(this.processId,  this.name, this.icon, this.type, this.description, this.status);
  }
}