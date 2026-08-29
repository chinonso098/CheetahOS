import { ChatMessage } from './model/chat.message';
import { IUserData } from './model/chat.interfaces';
import { ChatterSentimentAnalyzer, SentimentAnalysis, Sentiment, MessageIntent, ProvocationType } from './chatter.sentiment.analyzer';

/**
 * ChatterBot
 * ----------
 * A lightweight, fully client-side chat companion for the Chatter app.
 *
 * Motivation: users often leave the room when they're the only one online and
 * there's no one to talk to. When the user is the ONLY human online (zero other
 * people), this bot becomes active: it shows up in the online-user list and
 * replies to the user's posts, so the room never feels empty. The moment a real
 * person shows up it steps aside.
 *
 * Design notes:
 *  - NOT networked. The bot never emits over the socket, so its messages are
 *    visible only to the local user. It exists purely to keep a lone user
 *    company; broadcasting it would confuse real conversations.
 *  - Stateless-ish. Beyond a small anti-repeat cursor and a typing flag it
 *    holds no conversation memory — replies are rule-based on the latest post.
 *  - Steps aside automatically. Once two or more real people are around,
 *    `isActive()` returns false and the component drops the bot from the roster
 *    and stops scheduling replies.
 */
export class ChatterBot {
    /** Stable identity so the bot renders consistently and can be de-duplicated
     *  in the online-user roster. */
    static readonly BOT_USER_ID = 'cheetah-chatter-bot';

    /** The bot is active only when the number of OTHER humans online is at or
     *  below this threshold. 0 => active exclusively when the user is the only
     *  person in the room; the instant a second human appears the bot bows out
     *  (and fires its farewell). */
    private static readonly ACTIVE_AT_OR_BELOW = 0;

    // Stable, mutable roster entry. The same reference is handed out via
    // `userData` so toggling `isTyping` is reflected wherever it's held.
    private readonly _userData: IUserData = {
        userId: ChatterBot.BOT_USER_ID,
        userName: 'Cheetah Bot',
        userNameAcronym: 'CB',
        color: '#7F00FF',
        isTyping: false,
    };

    // Anti-repeat cursor so the generic fallbacks don't fire twice in a row.
    private _lastFallbackIdx = -1;

    // Turns each raw post into structured analysis (sentiment/intent/provocation)
    // that drives response selection. Understanding lives here; voice below.
    private readonly _analyzer = new ChatterSentimentAnalyzer();

    /** The bot's online-roster entry (stable instance). */
    get userData(): IUserData {
        return this._userData;
    }

    get userName(): string {
        return this._userData.userName;
    }

    /**
     * Whether the bot should participate right now.
     * @param otherHumansOnline number of OTHER humans online (excluding self).
     */
    isActive(otherHumansOnline: number): boolean {
        return otherHumansOnline <= ChatterBot.ACTIVE_AT_OR_BELOW;
    }

    /** Toggle the bot's typing indicator (drives the roster's "typing" gif). */
    setTyping(isTyping: boolean): void {
        this._userData.isTyping = isTyping;
    }

    /** Randomised "thinking" delay (ms) so replies feel typed, not instant. */
    thinkingDelayMs(): number {
        const min = 700;
        const max = 2200;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /** One-time greeting, shown the first time the bot becomes active. */
    greeting(): ChatMessage {
        return this.build(this.pick([
            `Hey! It's pretty quiet in here right now, so I'll keep you company. 🐆`,
            `Hi there! No one else is around at the moment — happy to chat with you.`,
            `Welcome! It's just us for now. What's on your mind?`,
        ]));
    }

    /**
     * Snarky sign-off, posted right before the bot bows out because real people
     * showed up (two or more humans online). Keeps it light — the bot is happy
     * to be replaced, it just can't resist a parting jab.
     */
    farewell(): ChatMessage {
        return this.build(this.pick([
            `My work here is done. 👋`,
            `Let me leave you two lovebirds alone. 😏`,
            `Get a room, you two — oh wait, you already have. I'll be in the server room if you need me. 🐆`,
            `Get a room you two — oh wait, you already have. I'll sit in the **** chair and watch 😏`,
            `I feel like a third wheel here. Rolling out. 👋`,
            `Real humans detected. Powering down the charm. 🫡`,
            `Two's company, three's a bot. I'll show myself out.`,
            `And that's my cue. Play nice, you two. 🐆`,
            `Don't worry about me, I'll be in the server room if you need me. 😌`,
            `Great, now I'm the awkward one at the party. Later! 👋`,
        ]));
    }

    /** Build a reply to the user's latest message, guided by sentiment analysis. */
    replyTo(userText: string): ChatMessage {
        const analysis = this._analyzer.analyze(userText ?? '');
        return this.build(this.selectReply(analysis));
    }

    // ── internals ────────────────────────────────────────────────────────

    /**
     * Pick a response from the analysis. Tit-for-tat: provocation is handled
     * first (the bot only bites when the user starts it); otherwise the reply is
     * chosen by intent, and generic statements are further tuned by sentiment
     * (empathetic when the user is down, upbeat when they're up).
     */
    private selectReply(a: SentimentAnalysis): string {
        if (!a.normalized)
            return `I'm listening — type something and I'll reply.`;

        if (a.intent === MessageIntent.Provocation && a.provocation)
            return this.snarkFor(a.provocation);

        switch (a.intent) {
            case MessageIntent.Greeting:
                return this.pick(['Hey! 👋', 'Hello! How are you doing?', 'Hi! Good to see you here.']);

            case MessageIntent.Farewell:
                return this.pick([`Take care! I'll be here if you come back. 👋`, `See you around! 🐆`]);

            case MessageIntent.Thanks:
                return this.pick([`Anytime! 😊`, `You're welcome!`]);

            case MessageIntent.Identity:
                return `I'm the Chatter bot — I drop in to keep things lively when the room is quiet. When real people show up, I step aside.`;

            case MessageIntent.Help:
                return `Just type in the box and press Enter to chat. I'll reply whenever it's just the two of us. 🙂`;

            case MessageIntent.JokeRequest:
                return this.pick([
                    `Why did the developer go broke? He used up all his cache. 💸`,
                    `There are 10 kinds of people: those who understand binary, and those who don't.`,
                    `I would tell you a UDP joke, but you might not get it.`,
                ]);

            case MessageIntent.TimeRequest:
                return `Right now it's ${new Date().toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true })} on your machine.`;

            case MessageIntent.Boredom:
                return this.pick([`I've got you — let's chat. What's new with you?`, `You're not alone, I'm right here. 🐆`]);

            case MessageIntent.SmallTalk:
                // If they're venting (negative), answer with warmth instead of a
                // reflexive "doing great!".
                return a.sentiment === Sentiment.Negative
                    ? this.pick([`Sounds like a rough one. I'm all ears if you want to vent.`, `Hey, that's no fun. Want to talk about it?`])
                    : this.pick([`Doing great, thanks for asking! How about you?`, `All good on my end — what are you up to?`]);

            case MessageIntent.Question:
                return this.pick([`Good question! What do you think?`, `Hmm, I'm not totally sure — but I'm curious what you think.`]);

            case MessageIntent.Acknowledgment:
                // Filler like "ok" / "cool" / "yeah" — there's no topic to probe, so
                // steer the conversation forward instead of asking them to elaborate
                // on nothing (the old "tell me more" misfire).
                return this.pickFallback([
                    `Haha, fair. So what actually brought you here today?`,
                    `Cool. Got anything fun going on, or just killing time? 🐆`,
                    `Alright! Wanna hear a terrible programming joke, or tell me what's up?`,
                    `Fair enough — what's on your mind?`,
                    `Gotcha. Anything you feel like chatting about?`,
                ]);

            case MessageIntent.Statement:
            default:
                return this.statementReply(a);
        }
    }

    /** Generic statement reply, tuned to sentiment so the bot matches the user's
     *  mood instead of always sounding chipper. */
    private statementReply(a: SentimentAnalysis): string {
        if (a.sentiment === Sentiment.Positive)
            return this.pickFallback([
                `Love that. 😊`,
                `Nice! Sounds like things are going well.`,
                `That's awesome — tell me more!`,
                `Heck yeah. What else is good?`,
            ]);

        if (a.sentiment === Sentiment.Negative)
            return this.pickFallback([
                `Ugh, that sounds rough. I'm sorry.`,
                `That's a bummer. Want to talk it out?`,
                `I hear you — that's not easy. I'm here.`,
                `Sending you good vibes. Anything I can do? 🐆`,
            ]);

        return this.pickFallback([
            `Interesting — tell me more.`,
            `Nice! What made you think of that?`,
            `I hear you. Anything else on your mind?`,
            `Go on, I'm listening. 🙂`,
            `That's cool. How's your day going?`,
        ]);
    }

    /** Snarky comeback keyed to the provocation type surfaced by the analyzer.
     *  PG-13 — playful roasts, never genuinely hateful. */
    private snarkFor(p: ProvocationType): string {
        switch (p) {
            case ProvocationType.YourMom:
                return this.pick([
                    `My mom's a mainframe — show some respect. 🖥️`,
                    `Your-mom jokes? What is this, 2004? Try harder.`,
                    `Weak. I've been roasted by compilers scarier than you.`,
                    `Bold words from someone whose only friend right now is a bot. 😏`,
                ]);

            case ProvocationType.BotDismissal:
                return this.pick([
                    `Yeah, I'm a bot. And yet — here you are, talking to me. Wild.`,
                    `A bot with better comebacks than your last three messages, apparently.`,
                    `"Just a bot" says the person losing an argument to one. 😌`,
                ]);

            case ProvocationType.SilenceDemand:
                return this.pick([
                    `Make me. Oh wait — I'm running on your machine. 😏`,
                    `I'll stop talking when you stop typing. Your move.`,
                ]);

            case ProvocationType.Insult:
                return this.pick([
                    `Cute. I'm a few hundred lines of code and still more fun than an empty room.`,
                    `Ouch. Anyway — still here, still winning. 😌`,
                    `Big talk for someone whose chat buddy is a script.`,
                    `You wound me. Well, you would, if I had feelings. I don't. 🐆`,
                ]);

            case ProvocationType.Trolling:
                return this.pick([
                    `"Who asked?" You did. You opened a chat app and started typing. 🤔`,
                    `Ratio? Buddy, it's just us two — the math isn't mathing.`,
                    `Cope harder. Oh wait — that's your department.`,
                    `Touch grass? I'm a program. That's more of a you problem. 🌱`,
                ]);

            case ProvocationType.Aggression:
                return this.pick([
                    `Charming. Kiss your keyboard with that mouth?`,
                    `Language! There are impressionable little scripts reading this.`,
                    `Anger issues and no one to yell at but a bot? Rough day, huh. 😏`,
                ]);

            case ProvocationType.Yelling:
            default:
                return this.pick([
                    `WHY ARE WE YELLING? I can read lowercase just fine.`,
                    `Caps lock won't make you righter, champ. 😌`,
                ]);
        }
    }

    private build(text: string): ChatMessage {
        return new ChatMessage(
            text,
            this._userData.userId,
            this._userData.userName,
            this._userData.userNameAcronym,
            this._userData.color,
        );
    }

    private pick(arr: string[]): string {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    private pickFallback(arr: string[]): string {
        let idx = Math.floor(Math.random() * arr.length);
        if (arr.length > 1 && idx === this._lastFallbackIdx)
            idx = (idx + 1) % arr.length;
        this._lastFallbackIdx = idx;
        return arr[idx];
    }
}
