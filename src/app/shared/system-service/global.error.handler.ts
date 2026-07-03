import { ErrorHandler, Injectable } from '@angular/core';

/**
 * Global Angular error handler.
 *
 * Monaco (the code editor's engine) throws a benign `Canceled` error whenever
 * in-flight async work — e.g. the word highlighter — is cancelled as the editor
 * is disposed (which happens every time a Code Editor window is closed). That
 * rejection is expected and harmless, but Angular's default handler logs it as
 * `ERROR Canceled: Canceled`, cluttering the console. We swallow only that
 * specific case and delegate everything else to the default behaviour.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

  private readonly _defaultHandler = new ErrorHandler();

  handleError(error: unknown): void {
    if (this.isCanceledError(error)) {
      return;
    }
    this._defaultHandler.handleError(error);
  }

  /** True for Monaco's cancellation sentinel (name/message === 'Canceled'). */
  private isCanceledError(error: unknown): boolean {
    const err = error as { name?: string; message?: string } | null;
    return !!err && (err.name === 'Canceled' || err.message === 'Canceled');
  }
}
