/**
 * Rate limiter for API calls
 * Ensures we stay within Open-Meteo's limits:
 * - 600 calls/minute
 * - 10,000 calls/day
 */

class RateLimiter {
    constructor({ maxPerMinute = 600, maxPerDay = 10000, delayBetweenCalls = 100 } = {}) {
        this.maxPerMinute = maxPerMinute;
        this.maxPerDay = maxPerDay;
        this.delayBetweenCalls = delayBetweenCalls;
        this.minuteCalls = [];
        this.dayCalls = [];
    }

    _cleanUp() {
        const now = Date.now();
        this.minuteCalls = this.minuteCalls.filter(t => now - t < 60_000);
        this.dayCalls = this.dayCalls.filter(t => now - t < 86_400_000);
    }

    canMakeCall() {
        this._cleanUp();
        return this.minuteCalls.length < this.maxPerMinute
            && this.dayCalls.length < this.maxPerDay;
    }

    recordCall() {
        const now = Date.now();
        this.minuteCalls.push(now);
        this.dayCalls.push(now);
    }

    getStatus() {
        this._cleanUp();
        return {
            minuteCalls: this.minuteCalls.length,
            minuteLimit: this.maxPerMinute,
            minuteRemaining: this.maxPerMinute - this.minuteCalls.length,
            dayCalls: this.dayCalls.length,
            dayLimit: this.maxPerDay,
            dayRemaining: this.maxPerDay - this.dayCalls.length,
        };
    }

    async wait() {
        return new Promise(resolve => setTimeout(resolve, this.delayBetweenCalls));
    }
}

export default new RateLimiter({
    maxPerMinute: 500,   // Leave buffer from 600 limit
    maxPerDay: 8000,     // Leave buffer from 10000 limit
    delayBetweenCalls: 150,
});
