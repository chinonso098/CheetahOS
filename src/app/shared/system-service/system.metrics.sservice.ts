import { Injectable } from '@angular/core';
import { AppUsage, SystemMetricsSnapshot } from 'src/app/system-files/commons/common.interfaces';
import { BaseService } from '../../system-files/base/base.service.interface';
import { Constants } from 'src/app/system-files/constants';
import { ProcessType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Service } from 'src/app/system-files/service';
import { ProcessIDService } from './process.id.service';
import { RunningProcessService } from './running.process.service';

/**
 * Collects session level system metrics: uptime, currently running
 * processes/services, and per-app usage (launch count + active time).
 *
 * Tracks SYSTEM UPTIME, APPS USED DURING SESSION AND FOR HOW LONG,
 * AND PROCESSES CURRENTLY RUNNING.
 */
@Injectable({
    providedIn: 'root'
})
export class SystemMetricService implements BaseService {

    private _processIdService!: ProcessIDService;
    private _runningProcessService!: RunningProcessService;

    private readonly STORAGE_KEY = 'system_metrics';

    private _sessionStartTS: number;
    private _appUsage: Map<string, AppUsage>;
    private _activeSessions: Map<string, number>;

    name = 'sys_metric_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'collects session uptime, app usage, and process metrics';

    constructor(processIDService: ProcessIDService, runningProcessService: RunningProcessService) {
        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;
        this._sessionStartTS = Date.now();
        this._appUsage = new Map<string, AppUsage>();
        this._activeSessions = new Map<string, number>();

        this.loadFromStorage();

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }

    /** Milliseconds since this OS session started. */
    getUptimeMs(): number {
        return Date.now() - this._sessionStartTS;
    }

    /** Count of processes currently in the running process list. */
    getRunningProcessCount(): number {
        return this._runningProcessService.getProcesses().length;
    }

    /** Count of services currently registered. */
    getRunningServiceCount(): number {
        return this._runningProcessService.getServices().length;
    }

    /** Record that an app was launched; increments launch count. */
    recordAppLaunch(appName: string): void {
        const now = Date.now();
        const usage = this._appUsage.get(appName) ?? {
            name: appName, launchCount: 0, totalActiveMs: 0, lastLaunchTS: now
        };

        usage.launchCount += 1;
        usage.lastLaunchTS = now;
        this._appUsage.set(appName, usage);
        this._activeSessions.set(appName, now);
        this.save();
    }

    /** Record that an app was closed; accrues active time since its launch. */
    recordAppClose(appName: string): void {
        const startTS = this._activeSessions.get(appName);
        if (startTS === undefined) return;

        const usage = this._appUsage.get(appName);
        if (usage) {
            usage.totalActiveMs += Date.now() - startTS;
            this._appUsage.set(appName, usage);
        }

        this._activeSessions.delete(appName);
        this.save();
    }

    /** Usage stats for a single app, if tracked. */
    getAppUsage(appName: string): AppUsage | undefined {
        return this._appUsage.get(appName);
    }

    /** All tracked app usage entries. */
    getAllAppUsage(): AppUsage[] {
        return Array.from(this._appUsage.values());
    }

    /** Point-in-time snapshot of all metrics. */
    getSnapshot(): SystemMetricsSnapshot {
        return {
            sessionStartTS: this._sessionStartTS,
            uptimeMs: this.getUptimeMs(),
            runningProcessCount: this.getRunningProcessCount(),
            runningServiceCount: this.getRunningServiceCount(),
            appUsage: this.getAllAppUsage()
        };
    }

    private save(): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.getAllAppUsage()));
    }

    private loadFromStorage(): void {
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (!data) return;
        try {
            const parsed = JSON.parse(data) as AppUsage[];
            if (Array.isArray(parsed)) {
                this._appUsage = new Map<string, AppUsage>(
                    parsed.map(u => [u.name, {
                        name: u.name,
                        launchCount: typeof u.launchCount === 'number' ? u.launchCount : 0,
                        totalActiveMs: typeof u.totalActiveMs === 'number' ? u.totalActiveMs : 0,
                        lastLaunchTS: typeof u.lastLaunchTS === 'number' ? u.lastLaunchTS : Date.now()
                    }])
                );
            }
        } catch {
            // Corrupt blob — start fresh rather than crash the OS boot path.
            this._appUsage = new Map<string, AppUsage>();
        }
    }

    private getProcessDetail(): Process {
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
    }

    private getServiceDetail(): Service {
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status);
    }
}