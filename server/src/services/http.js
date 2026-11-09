import { setTimeout as delay } from 'node:timers/promises';

// Bound every request, including response-body reads. Retry transient failures only.
export async function fetchJson(url, { fetchImpl = fetch, timeoutMs = 10000, retries = 2, wait = delay } = {}) {
    for (let attempt = 0; ; attempt++) {
        let retryable = true;
        try {
            const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
            if (!response.ok) {
                retryable = response.status === 429 || response.status >= 500;
                const error = new Error(`Upstream API error ${response.status}`);
                throw error;
            }
            return await response.json();
        } catch (error) {
            if (!retryable || attempt >= retries) throw error;
            await wait(250 * 2 ** attempt);
        }
    }
}
