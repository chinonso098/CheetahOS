/**
 * ChatterSentimentAnalyzer
 * ------------------------
 * A small, dependency-free NLP helper that turns a raw user post into a
 * structured `SentimentAnalysis`. It sits between the user's post and the bot:
 *
 *     user post ──► ChatterSentimentAnalyzer.analyze() ──► ChatterBot.pickReply()
 *
 * The bot no longer eyeballs raw regexes to decide what to say; instead it
 * switches on this analysis. Separating *understanding* (here) from *voice*
 * (the bot's response lists) makes both easier to tune and unit-test.
 *
 * Design:
 *  - Pure & stateless. `analyze()` has no side effects and no randomness, so
 *    the same input always yields the same analysis (great for tests).
 *  - Lexicon-based polarity with negation + intensifier handling and a small
 *    emoji lexicon — good enough for a chat toy, cheap enough to run per post.
 *  - Intent + provocation classification lifted out of the bot so hostile
 *    ("tit-for-tat") triggers and friendly intents live in one place.
 */

export enum Sentiment {
    Positive = 'positive',
    Negative = 'negative',
    Neutral = 'neutral',
}

/** High-level purpose of the message. Provocation is hostile; everything else
 *  is friendly/neutral. */
export enum MessageIntent {
    Greeting = 'greeting',
    Farewell = 'farewell',
    Thanks = 'thanks',
    Identity = 'identity',      // "who are you / are you a bot" — curious, not hostile
    Help = 'help',
    JokeRequest = 'joke',
    TimeRequest = 'time',
    Boredom = 'boredom',
    SmallTalk = 'smalltalk',    // "how are you / what's up"
    Acknowledgment = 'acknowledgment', // "ok", "oh okay", "yeah", "cool" — filler/backchannel
    Provocation = 'provocation',
    Question = 'question',      // generic question not matched above
    Statement = 'statement',    // generic catch-all
}

/** Sub-type when `intent === Provocation`. Mirrors the bot's snark buckets. */
export enum ProvocationType {
    YourMom = 'your_mom',
    BotDismissal = 'bot_dismissal',
    SilenceDemand = 'silence_demand',
    Insult = 'insult',
    Trolling = 'trolling',
    Aggression = 'aggression',
    Yelling = 'yelling',
}

export interface SentimentAnalysis {
    /** The original, untouched text. */
    raw: string;
    /** Lower-cased, trimmed text used for matching. */
    normalized: string;
    /** Overall polarity bucket. */
    sentiment: Sentiment;
    /** Signed polarity score (negative = negative sentiment). */
    score: number;
    /** Emphasis / "loudness" in 0..1 (caps, `!!!`, elongation, intensifiers). */
    intensity: number;
    /** Ends with `?`. */
    isQuestion: boolean;
    /** Basically all-caps yelling. */
    isShouting: boolean;
    /** Classified purpose of the message. */
    intent: MessageIntent;
    /** Hostility sub-type, or null when the message isn't provocative. */
    provocation: ProvocationType | null;
}

export class ChatterSentimentAnalyzer {

    // ── Lexicons ─────────────────────────────────────────────────────────
    // Weights are small integers; magnitude ≈ strength. Negative words tend to
    // carry a touch more weight since negativity usually reads stronger.
    private static readonly POSITIVE: Record<string, number> = {
        good: 1, great: 2, awesome: 2, amazing: 2, nice: 1, love: 2, like: 1,
        happy: 2, glad: 1, cool: 1, fun: 1, wonderful: 2, excellent: 2, best: 2,
        fantastic: 2, sweet: 1, enjoy: 1, excited: 2, yay: 2, lol: 1, haha: 1,
        lmao: 1, win: 1, wins: 1, winning: 1, thanks: 1, thank: 1, please: 1,
        yes: 1, yeah: 1, wow: 1,
    };

    private static readonly NEGATIVE: Record<string, number> = {
        bad: 2, terrible: 3, awful: 3, hate: 3, sad: 2, angry: 2, mad: 2,
        annoyed: 2, annoying: 2, boring: 2, bored: 2, suck: 2, sucks: 2,
        worst: 3, horrible: 3, ugly: 2, stupid: 2, dumb: 2, lame: 2, tired: 1,
        sick: 1, lonely: 2, depressed: 3, cry: 2, crying: 2, ugh: 1, meh: 1,
        trash: 2, garbage: 2, cringe: 2, useless: 2, no: 1, nope: 1, eww: 1, yuck: 1, gross: 1,
    };

    private static readonly NEGATORS = new Set([
        'not', 'no', 'never', 'dont', "don't", 'didnt', "didn't", 'isnt',
        "isn't", 'aint', "ain't", 'cant', "can't", 'wont', "won't", 'nothing',
    ]);

    private static readonly INTENSIFIERS = new Set([
        'very', 'so', 'really', 'super', 'extremely', 'totally', 'absolutely',
        'freaking', 'insanely', 'incredibly',
    ]);

    private static readonly POSITIVE_EMOJI = ['😊', '😀', '😁', '😄', '🙂', '😌', '❤', '❤️', '👍', '🐆', '🎉', '😂', '🤣', '😍'];
    private static readonly NEGATIVE_EMOJI = ['😢', '😭', '😠', '😡', '😤', '😒', '👎', '💔', '😞', '🙄', '😩', '🥺'];

    // ── Public API ───────────────────────────────────────────────────────

    analyze(raw: string): SentimentAnalysis {
        const text = raw ?? '';
        const normalized = text.toLowerCase().trim();

        const isQuestion = normalized.endsWith('?');
        const isShouting = this.isShouting(text);
        const { score, sentiment } = this.polarity(normalized);
        const intensity = this.intensity(text, normalized);

        // Hostile patterns win first — this is the tit-for-tat trigger set.
        let provocation = this.detectProvocation(normalized);
        let intent: MessageIntent;

        if (provocation) {
            intent = MessageIntent.Provocation;
        } else {
            intent = this.detectIntent(normalized, isQuestion);
            // All-caps yelling is treated as a mild provocation, but only when
            // the message is otherwise a generic, non-positive statement — an
            // excited "HELLO!" or "THANKS!!!" shouldn't get scolded.
            if (isShouting && intent === MessageIntent.Statement && sentiment !== Sentiment.Positive) {
                provocation = ProvocationType.Yelling;
                intent = MessageIntent.Provocation;
            }
        }

        return { raw: text, normalized, sentiment, score, intensity, isQuestion, isShouting, intent, provocation };
    }

    // ── Polarity ─────────────────────────────────────────────────────────

    private polarity(normalized: string): { score: number; sentiment: Sentiment } {
        const tokens = normalized.split(/[^a-z']+/i).filter(Boolean);
        let score = 0;

        for (let i = 0; i < tokens.length; i++) {
            const tok = tokens[i];
            let val = 0;
            if (ChatterSentimentAnalyzer.POSITIVE[tok] !== undefined) val = ChatterSentimentAnalyzer.POSITIVE[tok];
            else if (ChatterSentimentAnalyzer.NEGATIVE[tok] !== undefined) val = -ChatterSentimentAnalyzer.NEGATIVE[tok];
            if (val === 0) continue;

            // Negation within the previous two tokens flips the polarity.
            if (this.isNegated(tokens, i)) val = -val;

            // A preceding intensifier amplifies the term.
            if (i > 0 && ChatterSentimentAnalyzer.INTENSIFIERS.has(tokens[i - 1])) val *= 1.5;

            score += val;
        }

        // Emoji nudge polarity too.
        for (const e of ChatterSentimentAnalyzer.POSITIVE_EMOJI) if (normalized.includes(e)) score += 1;
        for (const e of ChatterSentimentAnalyzer.NEGATIVE_EMOJI) if (normalized.includes(e)) score -= 1;

        const sentiment = score > 0 ? Sentiment.Positive : score < 0 ? Sentiment.Negative : Sentiment.Neutral;
        return { score, sentiment };
    }

    private isNegated(tokens: string[], idx: number): boolean {
        for (let j = Math.max(0, idx - 2); j < idx; j++) {
            if (ChatterSentimentAnalyzer.NEGATORS.has(tokens[j])) return true;
        }
        return false;
    }

    // ── Intensity ────────────────────────────────────────────────────────

    private intensity(raw: string, normalized: string): number {
        let score = 0.2;

        const bangs = (raw.match(/!/g) || []).length;
        score += Math.min(bangs, 3) * 0.15;

        // Character elongation ("soooo", "nooo").
        if (/(.)\1{2,}/.test(normalized)) score += 0.2;

        // Caps ratio among letters.
        const letters = raw.replace(/[^a-zA-Z]/g, '');
        if (letters.length >= 3) {
            const caps = (raw.match(/[A-Z]/g) || []).length;
            score += (caps / letters.length) * 0.3;
        }

        // Explicit intensifiers.
        for (const w of ChatterSentimentAnalyzer.INTENSIFIERS) {
            if (new RegExp(`\\b${w}\\b`).test(normalized)) { score += 0.15; break; }
        }

        return Math.max(0, Math.min(1, score));
    }
    // Short backchannel / filler acknowledgments. When a whole (short) message
    // is made only of these it carries no topic to respond to — the bot should
    // steer the conversation rather than ask the user to elaborate on nothing.
    private static readonly ACKNOWLEDGMENTS = new Set([
        'ok', 'okay', 'k', 'kk', 'kay', 'mkay', 'oh', 'ah', 'yeah', 'yea', 'yep',
        'yup', 'ya', 'sure', 'cool', 'nice', 'right', 'alright', 'aight', 'gotcha',
        'hmm', 'hm', 'mm', 'mhm', 'lol', 'lmao', 'haha', 'meh', 'idk', 'dunno',
        'fine', 'bet', 'welp', 'oof', 'word', 'sec', 'noted',
    ]);
    // ── Intent classification ────────────────────────────────────────────

    private detectIntent(text: string, isQuestion: boolean): MessageIntent {
        if (/\b(hi|hello|hey|yo|howdy|hiya|sup)\b/.test(text) && !/how|what/.test(text))
            return MessageIntent.Greeting;

        if (/\b(bye|goodbye|see ya|see you|later|gtg|good ?night|farewell)\b/.test(text))
            return MessageIntent.Farewell;

        if (/\b(thanks|thank you|thx|ty|appreciate it)\b/.test(text))
            return MessageIntent.Thanks;

        if (/your name|who are you|what are you|are you a bot|are you real|are you human/.test(text))
            return MessageIntent.Identity;

        if (/\b(help|how do i|how does this work|what can you do)\b/.test(text))
            return MessageIntent.Help;

        if (/\b(joke|funny|make me laugh)\b/.test(text))
            return MessageIntent.JokeRequest;

        if (/\b(time|clock|what day|date)\b/.test(text))
            return MessageIntent.TimeRequest;

        if (/\b(bored|boring|lonely|alone|quiet|nobody|no ?one|empty)\b/.test(text))
            return MessageIntent.Boredom;

        if (/how are you|how's it going|hows it going|how are things|what'?s up|whats up|\bwyd\b/.test(text))
            return MessageIntent.SmallTalk;

        if (this.isAcknowledgment(text))
            return MessageIntent.Acknowledgment;

        if (isQuestion)
            return MessageIntent.Question;

        return MessageIntent.Statement;
    }

    /** True when a short message is made up ENTIRELY of filler / backchannel
     *  acknowledgments ("ok", "oh okay", "yeah", "cool") — i.e. it carries no
     *  topic worth probing. Capped at 3 tokens so real statements that merely
     *  start with a filler ("cool game") aren't swallowed. */
    private isAcknowledgment(text: string): boolean {
        const tokens = text.split(/[^a-z]+/i).filter(Boolean);
        if (tokens.length === 0 || tokens.length > 3) return false;
        return tokens.every(t => ChatterSentimentAnalyzer.ACKNOWLEDGMENTS.has(t));
    }

    // ── Provocation classification (tit-for-tat triggers) ────────────────

    private detectProvocation(text: string): ProvocationType | null {
        if (/\b(your|ur|yo)\s?(mom|mum|mother|mama|momma)\b/.test(text))
            return ProvocationType.YourMom;

        if (/just a bot|only a bot|stupid bot|dumb bot|not real|you'?re fake|fake bot/.test(text))
            return ProvocationType.BotDismissal;

        if (/shut ?up|stfu|shut it|be quiet|quiet down/.test(text))
            return ProvocationType.SilenceDemand;

        if (/\byou (suck|stink)\b|you'?re (dumb|stupid|lame|useless|trash|garbage|boring|mid|cringe|annoying)|\b(dumb|stupid|useless|trash|garbage|lame|boring|cringe)\b/.test(text))
            return ProvocationType.Insult;

        if (/who ?asked|nobody asked|\bratio\b|\bcope\b|\bseethe\b|cry about it|\bl\b bot|\bmalding\b|touch grass/.test(text))
            return ProvocationType.Trolling;

        if (/screw you|go to hell|i hate you|\bf+ ?u+\b|\bf off\b|piss off|get lost/.test(text))
            return ProvocationType.Aggression;

        return null;
    }

    /** True when the message is basically all-caps yelling (enough letters and
     *  no lowercase among them). */
    private isShouting(raw: string): boolean {
        const letters = raw.replace(/[^a-zA-Z]/g, '');
        return letters.length >= 4 && letters === letters.toUpperCase();
    }
}
