import { Injectable } from "@angular/core";
import { ScriptService } from "src/app/shared/system-service/script.services";

/**
 * Minimal shape of the global `eSheep` constructor exported by
 * `osdrive/Program-Files/esheep64/esheep.js` (see `window.eSheep`).
 */
interface ESheepConstructor {
  new (options?: { allowPets?: string; allowPopup?: string }): { Start: (xml?: string) => void };
  /** Tears down every live pet (root, children and popup-spawned). */
  removeAll?: () => void;
}

/**
 * ESheepService — owns the lifecycle of the "eSheep" desktop pet.
 *
 * Mirrors ClippyService (§1.1.1): the start/stop logic that used to sit
 * inline in DesktopComponent.ngAfterViewInit (the `// TESTING` block) now
 * lives here so the component stays thin and the pet can be toggled from
 * the desktop context menu and force-stopped on screen lock.
 *
 * Behaviour:
 *   - `start()` lazily loads esheep.js, then constructs and starts one pet.
 *     Idempotent: a second call while already active is a no-op.
 *   - `stop()` removes every live pet, then UNLOADS esheep.js and clears
 *     the global export so the next `start()` re-fetches a clean script.
 *   - esheep.js is wrapped in an IIFE, so unload + reload is safe (no
 *     `const`/`class` redeclaration error).
 *
 * Provided in root so the same instance is shared by the desktop context
 * menu, the lock-screen handler, and anything else that toggles the pet.
 */
@Injectable({
  providedIn: 'root'
})
export class ESheepHandler {

  /** Logical asset name + source used with ScriptService. */
  private readonly ESHEEP_SCRIPT_NAME = 'esheep';
  private readonly ESHEEP_SCRIPT_SRC = 'osdrive/Program-Files/esheep64/esheep.js';

  /** Options handed to the pet on construction. */
  private readonly ESHEEP_OPTIONS = { allowPets: 'yes', allowPopup: 'yes' };

  /** Whether a pet is currently running. */
  private _active = false;

  constructor(private _scriptService: ScriptService) {}

  /** Read-only view of the active flag, for the context-menu label. */
  get isActive(): boolean {
    return this._active;
  }

  /**
   * Load esheep.js (once) and start a single pet. No-op if already active.
   */
  async start(): Promise<void> {
    if (this._active) return;

    await this._scriptService.loadScript(this.ESHEEP_SCRIPT_NAME, this.ESHEEP_SCRIPT_SRC, false);

    const eSheepCtor = (window as unknown as Record<string, unknown>)['eSheep'] as ESheepConstructor | undefined;
    if (!eSheepCtor) {
      throw new Error('eSheep failed to load: window.eSheep is undefined');
    }

    new eSheepCtor(this.ESHEEP_OPTIONS).Start();
    this._active = true;
  }

  /**
   * Remove every live pet, unload esheep.js and clear the global export.
   * No-op if not currently active.
   */
  stop(): void {
    if (!this._active) return;

    const globals = window as unknown as Record<string, unknown>;
    const eSheepCtor = globals['eSheep'] as ESheepConstructor | undefined;
    eSheepCtor?.removeAll?.();

    this._scriptService.unloadScript(this.ESHEEP_SCRIPT_NAME, this.ESHEEP_SCRIPT_SRC);
    delete globals['eSheep'];

    this._active = false;
  }

  /** Toggle the pet on/off (used by the desktop context menu). */
  async toggle(): Promise<void> {
    if (this._active) {
      this.stop();
    } else {
      await this.start();
    }
  }
}
