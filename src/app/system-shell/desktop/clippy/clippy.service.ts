import { Injectable } from "@angular/core";
import { ActivityHistoryService } from "src/app/shared/system-service/activity.tracking.service";
import { ProcessHandlerService } from "src/app/shared/system-service/process.handler.service";
import { RunningProcessService } from "src/app/shared/system-service/running.process.service";
import { CommonFunctions } from "src/app/system-files/commons/common.functions";
import { DesktopGeneralHelper } from "../desktop.general.helper";

/**
 * ClippyService — extracted from DesktopComponent (§1.1.1).
 *
 * Owns the lifecycle of the periodic "Clippy" spawning loop and the
 * coordinated tear-down of any in-flight / about-to-mount Clippy
 * instances. Previously these fields and methods lived directly on
 * DesktopComponent, contributing to that file's god-class problem.
 *
 * Behaviour is preserved 1:1 from the original implementation:
 *   - Clippy starts disabled. `init()` is a no-op until `start()` is
 *     called (current product behaviour — `start()` is not wired to
 *     any user-reachable action today, only a commented-out call site).
 *   - `stop()` flips the enabled flag FIRST, then performs a cascaded
 *     cleanup pass: clear the spawn interval, cancel pending follow-up
 *     timers, close every currently-registered Clippy process, then
 *     schedule a few delayed follow-up close passes to catch Clippy
 *     instances that were mid-bootstrap when stop ran.
 *   - `start()` cancels any pending follow-up close passes BEFORE
 *     re-enabling, otherwise a stale follow-up timer would close the
 *     freshly re-enabled Clippy.
 *
 * Provided in root so the same instance is shared with anything else
 * that ever needs to start/stop Clippy (taskbar, settings panel, etc.).
 */
@Injectable({
    providedIn: 'root'
})
export class ClippyService {

    /** App name used by the process system to identify Clippy. */
    private readonly CLIPPY_APP = 'clippy';

    /** Interval between Clippy spawns once enabled. 5 minutes. */
    private readonly INIT_DELAY_MS = 300000;

    /**
     * Delays (ms) at which `stop()` re-runs `closeAllProcesses()` after
     * the initial close pass. A Clippy spawned ~ms before stop() ran
     * may still be bootstrapping (its component constructor not yet
     * executed, so it isn't in the running-process list yet). The
     * delayed re-runs catch it once it registers.
     */
    private readonly FOLLOW_UP_DELAYS_MS = [50, 250, 750];

    /** Whether the spawn loop is currently allowed to run. */
    private _enabled = false;

    /** Id of the recurring spawn interval, or undefined when not running. */
    private _intervalId?: NodeJS.Timeout;

    /**
     * Ids of pending follow-up close passes scheduled by `stop()`.
     * Tracked so that a subsequent `start()` (or another `stop()`)
     * can cancel them; without this, a stale follow-up could close
     * a Clippy the user just re-enabled.
     */
    private _followUpTimeoutIds: NodeJS.Timeout[] = [];

    constructor(
        private _runningProcessService: RunningProcessService,
        private _processHandlerService: ProcessHandlerService,
        private _activityHistoryService: ActivityHistoryService,
    ) {}

    /** Read-only view of the enabled flag, for templates / debugging. */
    get isEnabled(): boolean {
        return this._enabled;
    }

    /**
     * Start the periodic spawn loop IF currently enabled. Idempotent
     * when called while already running (the previous interval is
     * cleared first to avoid stacking duplicate timers).
     *
     * Called once from DesktopComponent.ngAfterViewInit; safe to call
     * again from `start()` when re-enabling.
     */
    init(): void {
        if (!this._enabled) return;

        // Defensive: if init() is somehow called twice without an
        // intervening stop(), clear the old interval first so we don't
        // leak a timer with no handle.
        if (this._intervalId !== undefined) {
            clearInterval(this._intervalId);
        }

        this._intervalId = setInterval(() => {
            // Guard: a tick may already be queued when stop() runs.
            // Without this, a Clippy can spawn AFTER the screen is locked.
            if (!this._enabled) return;

            // Pure helper builds the descriptor; this service runs the
            // service-side triad itself (§1.1.5: helpers stay service-free).
            // For clippy, `activityToTrack` is intentionally null \u2014 the
            // helper excludes the clippy app from activity history.
            const desc = DesktopGeneralHelper.prepareAppLaunch(this.CLIPPY_APP);
            if (desc.activityToTrack) {
                CommonFunctions.trackActivity(this._activityHistoryService, desc.activityToTrack);
            }
            this._processHandlerService.runApplication(desc.file);
        }, this.INIT_DELAY_MS);
    }

    /**
     * Disable the spawn loop and close every Clippy currently alive
     * (or about to come alive). See class-level comment for ordering
     * rationale.
     */
    stop(): void {
        // 1) Flip the flag FIRST so any in-flight interval tick bails
        //    out before it spawns another Clippy.
        this._enabled = false;

        if (this._intervalId !== undefined) {
            clearInterval(this._intervalId);
            this._intervalId = undefined;
        }

        // 2) Cancel any follow-up close passes still pending from a
        //    PRIOR stop() call. Without this, repeated stop calls
        //    would stack up redundant timers (harmless but wasteful)
        //    and — more importantly — leave stale ids in the tracking
        //    array.
        this.clearFollowUpTimeouts();

        // 3) Close every Clippy instance currently registered.
        //    getProcessByName only returns the first match, so we
        //    iterate over all processes in case more than one is alive
        //    (overlapping spawns / self-destruct not yet completed).
        this.closeAllProcesses();

        // 4) A Clippy spawned ~ms before stop() ran may still be
        //    bootstrapping. Re-run the close pass a few times on a
        //    short delay to catch it once it registers. Track every
        //    timeout id so start() can cancel them.
        for (const delay of this.FOLLOW_UP_DELAYS_MS) {
            const id = setTimeout(() => this.closeAllProcesses(), delay);
            this._followUpTimeoutIds.push(id);
        }
    }

    /**
     * Re-enable the spawn loop. Cancels any pending stop() follow-up
     * close passes first — otherwise the freshly-spawned Clippy would
     * be force-closed by a stale timer.
     */
    start(): void {
        this.clearFollowUpTimeouts();
        this._enabled = true;
        this.init();
    }

    // ---- private helpers ---------------------------------------------------

    private clearFollowUpTimeouts(): void {
        for (const id of this._followUpTimeoutIds) {
            clearTimeout(id);
        }
        this._followUpTimeoutIds = [];
    }

    private closeAllProcesses(): void {
        const processes = this._runningProcessService
            .getProcesses()
            .filter(p => p.getProcessName === this.CLIPPY_APP);

        for (const clippy of processes) {
            this._runningProcessService.closeProcessNotify.next(clippy);
        }
    }
}
