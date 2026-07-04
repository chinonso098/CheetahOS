import { AbstractControl, ValidationErrors } from '@angular/forms';
import { Constants } from 'src/app/system-files/constants';

/**
 * Reserved-handle guard for the chat app. This is NOT a profanity check — it's
 * identity protection: "There can only be one Dev."
 *
 * A whole name that resolves to a reserved handle (in any case, with padding,
 * or with hidden/zero-width characters) is rejected, while names that merely
 * CONTAIN it — Devon, Devin — are perfectly fine.
 */
export class ReservedNameValidator {

  // Handles a normal user may not adopt. Lowercase only.
  private static readonly RESERVED_NAMES: ReadonlySet<string> = new Set(['dev']);

  /** Collapse whitespace + zero-width/invisible characters and lowercase, so
   *  "  D e v ", "DEV", and "d\u200Bev" all canonicalize to "dev". */
  private static canonical(text: string): string {
    if (!text) return Constants.EMPTY_STRING;
    return text
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, Constants.EMPTY_STRING)
      .replace(/[\s\u00A0\u1680\u2000-\u200F\u2028\u2029\u202F\u205F\u2060\u3000\uFEFF]/g, Constants.EMPTY_STRING)
      .toLowerCase();
  }

  /** Angular group validator: the first+last name combination may not spell a
   *  reserved handle (e.g. "Dev"). Checks both field orders so it can't be
   *  smuggled in by splitting across the two inputs (e.g. "De" + "v"). */
  static validator(group: AbstractControl): ValidationErrors | null {
    const first = ReservedNameValidator.canonical(group.get('firstName')?.value ?? Constants.EMPTY_STRING);
    const last = ReservedNameValidator.canonical(group.get('lastName')?.value ?? Constants.EMPTY_STRING);
    const combos = [`${first}${last}`, `${last}${first}`];
    return combos.some((c) => ReservedNameValidator.RESERVED_NAMES.has(c))
      ? { reservedName: true }
      : null;
  }
}
