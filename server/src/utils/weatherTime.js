// Forecast requests use Asia/Ho_Chi_Minh; legacy rows omit its UTC+7 offset.
export const WEATHER_UTC_OFFSET_SECONDS = 7 * 60 * 60;

export function weatherTimeToUtc(value, utcOffsetSeconds = WEATHER_UTC_OFFSET_SECONDS) {
    // Parse wall-clock time as UTC first, then apply the upstream offset explicitly.
    // This must not depend on the server's local timezone.
    const hasOffset = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
    const timestamp = hasOffset
        ? Date.parse(value)
        : Date.parse(`${value.replace(' ', 'T')}Z`) - utcOffsetSeconds * 1000;
    return new Date(timestamp).toISOString();
}
