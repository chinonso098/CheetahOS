import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Lightweight, dependency-free profanity guard for the chat app.
 *
 * It does two jobs:
 *   - isProfane(text): true if the text contains a banned word (used to reject
 *     crude/obscene usernames).
 *   - clean(text): replaces any banned word with asterisks (used to censor chat
 *     messages) while preserving the rest of the message untouched.
 *
 * "People are clever, so you have to be too": each banned word is matched with
 * a tolerant pattern that defeats the usual evasion tricks —
 *   - leetspeak substitutions (f4ck, sh1t, @ss, $hit, b00bs ...),
 *   - repeated letters (fuuuuck),
 *   - separators wedged between letters (f.u.c.k, s h i t, f-u-c-k, f*ck),
 *   - accents (fück), case,
 *   - and reversed spellings (yssup, kcuf, tihs).
 * Word boundaries are still respected so innocent substrings (class, Scunthorpe,
 * assassin, etc.) are NOT flagged.
 */
export class ProfanityFilter {

  // Base banned stems. Variants/plurals are handled by the matcher, so keep the
  // root form here. Lowercase only.
  private static readonly BAD_WORDS: string[] = [
    'anus', 'arse', 'ass', 'asshole', 'bastard', 'bitch', 'bollock', 'boob',
    'bollocks', 'bullshit', 'clit', 'cock', 'coon', 'crap', 'cum', 'cunt',
    'damn', 'dick', 'dickhead', 'dildo', 'dyke', 'fag', 'faggot', 'fellatio',
    'fuck', 'fucker', 'goddamn', 'handjob', 'hoe', 'horny', 'jackass', 'jizz',
    'kike', 'knob', 'motherfucker', 'nigga', 'nigger', 'nipple', 'penis',
    'piss', 'prick', 'pussy', 'queer', 'retard', 'scrotum', 'shit', 'slut',
    'spic', 'tit','tities', 'titties', 'twat', 'vagina', 'wank', 'wanker', 'whore',
  ];

  // Leetspeak / look-alike substitutions per letter. Used to build a character
  // class for each letter of a banned word.
  private static readonly LEET: Record<string, string> = {
    a: 'a4@', b: 'b8', c: 'c(', e: 'e3', g: 'g69', i: 'i1l!|', l: 'l1|i',
    o: 'o0', s: 's5$z', t: 't7+', u: 'uv', z: 'z2',
  };

  // Characters allowed BETWEEN letters of a word (evasion via separators).
  private static readonly SEP = '[\\s._*\\-]{0,2}';

  private static _patterns: RegExp[] | null = null;

  private static escape(ch: string): string {
    return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private static buildPatterns(): RegExp[] {
    if (this._patterns) return this._patterns;

    this._patterns = this.BAD_WORDS.map((word) => {
      const body = word
        .split('')
        .map((ch) => {
          const variants = this.LEET[ch] ?? ch;
          const cls = variants.split('').map((c) => this.escape(c)).join('');
          // one-or-more of the letter (defeats repeats) + optional separators.
          return `[${cls}]+${this.SEP}`;
        })
        .join('');
      // Boundaries keep innocent substrings safe; allow trailing plural/suffix.
      return new RegExp(`\\b${body}[a-z]{0,3}\\b`, 'gi');
    });
    return this._patterns;
  }

  /** Normalize accents so "fück" reads as "fuck". */
  private static normalize(text: string): string {
    return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  }

  /** Reverse a string (defeats backwards evasion like "yssup", "kcuf"). */
  private static reverse(text: string): string {
    return text.split('').reverse().join('');
  }

  /** True if the text contains any banned word (forwards OR backwards). */
  static isProfane(text: string): boolean {
    if (!text) return false;
    const normalized = this.normalize(text);
    const reversed = this.reverse(normalized);
    return this.buildPatterns().some((re) => {
      re.lastIndex = 0;
      if (re.test(normalized)) return true;
      re.lastIndex = 0;
      return re.test(reversed);
    });
  }

  /** Replace any banned word with asterisks (length-preserving, min 3). */
  static clean(text: string): string {
    if (!text) return text;
    const censor = (m: string) => '*'.repeat(Math.max(3, m.length));
    let out = this.normalize(text);
    for (const re of this.buildPatterns()) {
      re.lastIndex = 0;
      out = out.replace(re, censor);
    }
    // Second pass on the reversed string catches backwards spellings
    // ("yssup", "kcuf"). Asterisks are symmetric, so reversing back is safe.
    let rev = this.reverse(out);
    for (const re of this.buildPatterns()) {
      re.lastIndex = 0;
      rev = rev.replace(re, censor);
    }
    return this.reverse(rev);
  }

  /** Angular reactive-forms validator: rejects profane control values. */
  static validator(control: AbstractControl): ValidationErrors | null {
    const value = control.value as string;
    return ProfanityFilter.isProfane(value) ? { profanity: true } : null;
  }
}
