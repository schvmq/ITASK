/**
 * Date and Time formatters for ITASK Chat & Messages.
 * Default timezone: Asia/Manila per spec.
 */

const DEFAULT_TIMEZONE = 'Asia/Manila';

function getUserTimeZone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
    } catch {
        return DEFAULT_TIMEZONE;
    }
}

/**
 * Format read receipt timestamp:
 * "Today, 10:45 AM", "Yesterday, 10:45 AM", or "Oct 3, 2026, 10:45 AM".
 */
export function formatReadReceiptTime(isoString: string): string {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        const timeZone = getUserTimeZone();

        const now = new Date();
        const nowParts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
        }).formatToParts(now);

        const dateParts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
        }).formatToParts(date);

        const getPart = (parts: Intl.DateTimeFormatPart[], type: string) =>
            parts.find((p) => p.type === type)?.value;

        const isSameYear = getPart(nowParts, 'year') === getPart(dateParts, 'year');
        const isSameMonth = getPart(nowParts, 'month') === getPart(dateParts, 'month');
        const isSameDay = getPart(nowParts, 'day') === getPart(dateParts, 'day');

        const timeFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
        const formattedTime = timeFormatter.format(date);

        if (isSameYear && isSameMonth && isSameDay) {
            return `Today, ${formattedTime}`;
        }

        // Check yesterday
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yParts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
        }).formatToParts(yesterday);

        const isYesterday =
            getPart(yParts, 'year') === getPart(dateParts, 'year') &&
            getPart(yParts, 'month') === getPart(dateParts, 'month') &&
            getPart(yParts, 'day') === getPart(dateParts, 'day');

        if (isYesterday) {
            return `Yesterday, ${formattedTime}`;
        }

        const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

        return `${fullDateFormatter.format(date)}, ${formattedTime}`;
    } catch {
        return '';
    }
}

/**
 * Full Date and Time for Tooltips:
 * e.g., "Saturday, October 3, 2026 at 10:45 AM (PHT)"
 */
export function formatFullTooltipDateTime(isoString: string): string {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        const timeZone = getUserTimeZone();
        return new Intl.DateTimeFormat('en-US', {
            timeZone,
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZoneName: 'short',
        }).format(date);
    } catch {
        return '';
    }
}

/**
 * Relative time for conversation list: "2m", "1h", "Yesterday", "Mon", "Oct 3"
 */
export function formatConversationTime(isoString: string): string {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'now';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}
