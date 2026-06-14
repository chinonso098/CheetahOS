import { Subscription } from 'rxjs';

/**
 * Tiny helper to collect RxJS subscriptions and tear them down in one
 * call. Replaces the repetitive `private _xSub!: Subscription` field +
 * matching `_xSub?.unsubscribe()` line in `ngOnDestroy` that both
 * window components carried.
 *
 * Usage:
 *   private readonly _subs = new SubscriptionBag();
 *   ...
 *   this._subs.add(stream.subscribe(...));
 *   ...
 *   ngOnDestroy() { this._subs.unsubscribeAll(); }
 *
 * Calling `unsubscribeAll` twice is safe -- internal list is cleared
 * after the first call so subsequent calls are no-ops.
 *
 * Not a service / not DI-aware on purpose: instantiated per component
 * with `new`, so each window has its own bag and there is no shared
 * state across windows.
 */
export class SubscriptionBag {
    private _subscriptions: Subscription[] = [];

    /** Track a subscription. Returns the same subscription for chaining. */
    add(subscription: Subscription): Subscription {
        this._subscriptions.push(subscription);
        return subscription;
    }

    /** Unsubscribe every tracked subscription and clear the internal list. */
    unsubscribeAll(): void {
        for (const sub of this._subscriptions) {
            sub?.unsubscribe();
        }
        this._subscriptions.length = 0;
    }

    /** Current number of tracked subscriptions (useful for tests). */
    get size(): number {
        return this._subscriptions.length;
    }
}
