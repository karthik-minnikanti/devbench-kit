/**
 * Format date as YYYY-MM-DD using local timezone
 * This ensures dates are calculated based on the user's local time, not UTC
 */
export const formatDateLocal = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

