"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateAge = calculateAge;
exports.isDateInRange = isDateInRange;
exports.formatDate = formatDate;
exports.getAgeAppropriateRange = getAgeAppropriateRange;
exports.parseDateSafely = parseDateSafely;
exports.getCalendarWeek = getCalendarWeek;
exports.getCalendarDateRange = getCalendarDateRange;
function calculateAge(dateOfBirth, inMonths = false) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    if (inMonths) {
        const months = (today.getFullYear() - birthDate.getFullYear()) * 12 +
            (today.getMonth() - birthDate.getMonth());
        return months;
    }
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}
function isDateInRange(date, startDate, endDate) {
    return date >= startDate && date <= endDate;
}
function formatDate(date, format = 'short') {
    switch (format) {
        case 'short':
            return date.toLocaleDateString();
        case 'long':
            return date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        case 'iso':
            return date.toISOString();
        default:
            return date.toLocaleDateString();
    }
}
function getAgeAppropriateRange(age) {
    const buffer = 2;
    return {
        minAge: Math.max(0, age - buffer),
        maxAge: age + buffer
    };
}
function parseDateSafely(dateString) {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return null;
        }
        return date;
    }
    catch {
        return null;
    }
}
function getCalendarWeek(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return {
        year: date.getFullYear(),
        week: weekNumber
    };
}
function getCalendarDateRange(view, date = new Date()) {
    const start = new Date(date);
    const end = new Date(date);
    switch (view) {
        case 'week':
            const dayOfWeek = start.getDay();
            start.setDate(start.getDate() - dayOfWeek);
            end.setDate(end.getDate() + (6 - dayOfWeek));
            break;
        case 'month':
            start.setDate(1);
            end.setMonth(end.getMonth() + 1, 0);
            break;
        case 'year':
            start.setMonth(0, 1);
            end.setMonth(11, 31);
            break;
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}
//# sourceMappingURL=dateUtils.js.map