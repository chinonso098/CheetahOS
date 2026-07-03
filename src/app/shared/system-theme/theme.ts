import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { filter, map } from "rxjs/operators";

import { Constants } from "src/app/system-files/constants";
import { DefaultService } from "../system-service/defaults.services";
import { ProcessType } from "src/app/system-files/commons/common.enums";
import { BaseService } from "src/app/system-files/base/base.service.interface";
import { Service } from "src/app/system-files/service";
import { Process } from "src/app/system-files/process";
import { ProcessIDService } from "../system-service/process.id.service";
import { RunningProcessService } from "../system-service/running.process.service";

/**
 * Single source of truth for the system-wide light/dark theme.
 *
 * Theme state is persisted through DefaultService under the
 * Constants.DEFAULT_THEME key (value is Constants.THEME_DARK / THEME_LIGHT),
 * so it survives reloads alongside every other user setting. Components
 * subscribe to `themeChange` to react when the theme is toggled at runtime.
 */
@Injectable({
    providedIn: 'root'
})
export class ThemeService implements BaseService {

    private _processIdService!:ProcessIDService;
    private _runningProcessService!:RunningProcessService;
    private _defaultService!:DefaultService;

    name = 'theme_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'handles theme management';
        
    constructor(defaultService: DefaultService, processIdService: ProcessIDService, runningProcessService: RunningProcessService) { 
        this._defaultService = defaultService;
        this._processIdService = processIdService;
        this._runningProcessService = runningProcessService;

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }

    /** Current theme: Constants.THEME_DARK or Constants.THEME_LIGHT. */
    getTheme(): string {
        const stored = this._defaultService.getDefaultSetting(Constants.DEFAULT_THEME);
        return stored === Constants.THEME_LIGHT ? Constants.THEME_LIGHT : Constants.THEME_DARK;
    }

    /** True when the active theme is light. Convenience for host-class bindings. */
    isLightTheme(): boolean {
        return this.getTheme() === Constants.THEME_LIGHT;
    }

    /** Persists the theme and broadcasts the change to all subscribers. */
    setTheme(theme: string): void {
        const normalized = theme === Constants.THEME_LIGHT ? Constants.THEME_LIGHT : Constants.THEME_DARK;
        this._defaultService.updateDefaultData(Constants.DEFAULT_THEME, normalized);
    }

    /** Flips between light and dark, returning the new theme. */
    toggleTheme(): string {
        const next = this.isLightTheme() ? Constants.THEME_DARK : Constants.THEME_LIGHT;
        this.setTheme(next);
        return next;
    }

    /**
     * Emits the new theme string whenever it changes. Filters the shared
     * DefaultService notify stream down to just the theme key so subscribers
     * only fire on theme changes, not every settings write.
     */
    get themeChange(): Observable<string> {
        return this._defaultService.defaultSettingsChangeNotify.pipe(
            filter((key: string) => key === Constants.DEFAULT_THEME),
            map(() => this.getTheme())
        );
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}