import { Injectable } from "@angular/core";

import { Constants } from "src/app/system-files/constants";
import { ProcessType } from "src/app/system-files/system.types";

import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";

import { BaseService } from "../../system-files/base/base.service.interface";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { SessionManagementService } from "./session.management.service";
import { Subject } from "rxjs";

@Injectable({
    providedIn: 'root'
})
export class DefaultService implements BaseService{

    private _processIdService!:ProcessIDService;
    private _runningProcessService!:RunningProcessService;
    private _sessionManagementService!:SessionManagementService;

    private _defaultSettingsMap!:Map<string, string>; 
    private readonly _defaultSettingServiceKey = Constants.CHEETAH_DEFAULT_SETTINGS_KEY;

    defaultSettingsChangeNotify: Subject<string> = new Subject<string>();

    name = 'defaults_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'handles tracking of usr choice';

    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService, sessionManagementService:SessionManagementService) {
        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;
        this._sessionManagementService = sessionManagementService;

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());

        this.retrievePastSessionData(this._defaultSettingServiceKey);
    }

    /**
     * Builds a fresh map containing every known setting paired with its
     * factory-default value. This is the single source of truth for the
     * complete set of settings the app expects to exist.
     */
    private buildDefaultSettingsMap(): Map<string, string> {
        return new Map<string, string>([
            [Constants.DEFAULT_LOCK_SCREEN_TIMEOUT, Constants.DEFAULT_LOCK_SCREEN_TIMEOUT_VALUE],
            [Constants.DEFAULT_LOCK_SCREEN_BACKGROUND, Constants.DEFAULT_LOCK_SCREEN_BACKGROUND_VALUE],
            [Constants.DEFAULT_DESKTOP_BACKGROUND, Constants.DEFAULT_DESKTOP_BACKGROUND_VALUE],
            [Constants.DEFAULT_PREVIOUS_DESKTOP_PICTURE, Constants.DEFAULT_PREVIOUS_DESKTOP_PICTURE_VALUE],
            [Constants.DEFAULT_PREVIOUS_DESKTOP_SOLID_COLOR, Constants.DEFAULT_PREVIOUS_DESKTOP_SOLID_COLOR_VALUE],
            [Constants.DEFAULT_PREVIOUS_DESKTOP_DYNAMIC_IMG, Constants.DEFAULT_PREVIOUS_DESKTOP_DYNAMIC_IMG_VALUE],
            [Constants.DEFAULT_TASKBAR_COMBINATION, Constants.DEFAULT_TASKBAR_COMBINATION_VALUE],
            [Constants.DEFAULT_AUTO_HIDE_TASKBAR, Constants.DEFAULT_AUTO_HIDE_TASKBAR_VALUE],
            [Constants.DEFAULT_CLIP_BOARD_STATE, Constants.DEFAULT_CLIP_BOARD_STATE_VALUE],
            [Constants.DEFAULT_SCREEN_SAVER_STATE, Constants.DEFAULT_SCREEN_SAVER_STATE_VALUE],
            [Constants.DEFAULT_SCREEN_SAVER, Constants.DEFAULT_SCREEN_SAVER_VALUE],
            [Constants.DEFAULT_DISPLAY_DELETE_CONFIRMATION_DIALOG, Constants.DEFAULT_DISPLAY_DELETE_CONFIRMATION_DIALOG_VALUE],
            [Constants.DEFAULT_MOVE_TO_RECYCLE_BIN_ON_DELETE, Constants.DEFAULT_MOVE_TO_RECYCLE_BIN_ON_DELETE_VALUE],
            [Constants.DEFAULT_RESTORE_USER_OPENED_APPS, Constants.DEFAULT_RESTORE_USER_OPENED_APPS_VALUE],
            [Constants.DEFAULT_IS_USER_OPENED_APPS_RESTORED, Constants.DEFAULT_IS_USER_OPENED_APPS_RESTORED_VALUE],
            [Constants.DEFAULT_ENFORCE_VIEWPORT_BOUNDS, Constants.DEFAULT_ENFORCE_VIEWPORT_BOUNDS_VALUE],
            [Constants.DEFAULT_THEME, Constants.DEFAULT_THEME_VALUE],
            [Constants.RECENT_CHEETAH_COLORS, Constants.RECENT_CHEETAH_COLORS_VALUE],
            [Constants.DEFAULT_ACCENT_COLOR, Constants.DEFAULT_ACCENT_COLOR_VALUE],
            [Constants.DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR, Constants.DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR_VALUE],
            [Constants.DEFAULT_SHOW_ACCENT_COLOR_TITLE_BARS_AND_WINDOW_BORDERS, Constants.DEFAULT_SHOW_ACCENT_COLOR_TITLE_BARS_AND_WINDOW_BORDERS_VALUE],
            [Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT_ON_TITLE_BAR_AND_WINDOW_BORDER, Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT_ON_TITLE_BAR_AND_WINDOW_BORDER_VALUE],
            [Constants.DEFAULT_APPLY_TRANSPARENCY_EFFECT_TO_CONTEXT_MENU, Constants.DEFAULT_APPLY_TRANSPARENCY_EFFECT_TO_CONTEXT_MENU_VALUE],
            [Constants.DEFAULT_APPLY_ACCENT_COLOR_TO_TRANSPARENT_MENU, Constants.DEFAULT_APPLY_ACCENT_COLOR_TO_TRANSPARENT_MENU_VALUE],
            [Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT, Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT_VALUE],
            [Constants.DEFAULT_WHO_IS_THIS, Constants.DEFAULT_WHO_IS_THIS_VALUE]
        ]);
    }

    /**
     * Resets the in-memory settings to factory defaults and persists them.
     * Used on first run (no stored session) and by reset().
     */
    private initializeDefaultSettings(): void {
        this._defaultSettingsMap = this.buildDefaultSettingsMap();
        this._sessionManagementService.addMapBasedSession(this._defaultSettingServiceKey, this._defaultSettingsMap);
    }

    getDefaultSetting(key:string):string{
        // A single lookup is enough: get() already returns undefined for
        // missing keys, which we coalesce to the empty string.
        return this._defaultSettingsMap.get(key) ?? Constants.EMPTY_STRING;
    }

    updateDefaultData(key:string, val:string, raiseEvent:boolean = true):void{
        this._defaultSettingsMap.set(key, val);
        this._sessionManagementService.addMapBasedSession(this._defaultSettingServiceKey, this._defaultSettingsMap);
        
        if(raiseEvent)
            this.defaultSettingsChangeNotify.next(key);
    }

    private retrievePastSessionData(key:string):void{
        // This service only knows how to hydrate its own settings key. Any
        // other key is unexpected, so fall back to a known-good state rather
        // than leaving _defaultSettingsMap undefined.
        if(key !== this._defaultSettingServiceKey){
            this.initializeDefaultSettings();
            return;
        }

        const sessionData = this._sessionManagementService.getMapBasedSession(key);

        // No stored data (first run), or a corrupt/empty payload: start from
        // factory defaults. Checking size guards against an empty map being
        // adopted and leaving the app with no settings at all.
        if(!sessionData || sessionData.size === 0){
            this.initializeDefaultSettings();
            return;
        }

        // Stored data exists. Start from the full set of current defaults so
        // that any settings added since the user last saved are present, then
        // overlay the user's saved values on top. This prevents "schema drift"
        // where a returning user would otherwise be missing newly added keys.
        const mergedSettings = this.buildDefaultSettingsMap();
        for(const [storedKey, storedValue] of sessionData){
            mergedSettings.set(storedKey, storedValue);
        }
        this._defaultSettingsMap = mergedSettings;

        // Persist the merged result so the stored session is brought up to date
        // with the current set of settings.
        this._sessionManagementService.addMapBasedSession(this._defaultSettingServiceKey, this._defaultSettingsMap);
    }

    public reset():void{
        this._defaultSettingsMap.clear();
        this.initializeDefaultSettings();
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}
