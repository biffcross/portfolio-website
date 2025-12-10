import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { differenceInDays, isSameDay, getMonth, getYear } from 'date-fns';

const UK_TIMEZONE = 'Europe/London';

/**
 * Get the current date and time in UK timezone
 */
export function getCurrentUKTime(): Date {
  return toZonedTime(new Date(), UK_TIMEZONE);
}

/**
 * Check if the current date is in December
 */
export function isDecember(date?: Date): boolean {
  const ukTime = date || getCurrentUKTime();
  return getMonth(ukTime) === 11; // December is month 11 (0-indexed)
}

/**
 * Check if the current date is January
 */
export function isJanuary(date?: Date): boolean {
  const ukTime = date || getCurrentUKTime();
  return getMonth(ukTime) === 0; // January is month 0 (0-indexed)
}

/**
 * Get Christmas Day for the current year in UK timezone
 */
export function getChristmasDay(year?: number): Date {
  const currentYear = year || getYear(getCurrentUKTime());
  // Create Christmas Day at midnight UK time
  const christmasUTC = fromZonedTime(new Date(currentYear, 11, 25, 0, 0, 0), UK_TIMEZONE);
  return toZonedTime(christmasUTC, UK_TIMEZONE);
}

/**
 * Check if the current date is Christmas Day in UK timezone
 */
export function isChristmasDay(date?: Date): boolean {
  const ukTime = date || getCurrentUKTime();
  const christmasDay = getChristmasDay(getYear(ukTime));
  return isSameDay(ukTime, christmasDay);
}

/**
 * Calculate days until Christmas from the current date
 * Returns 0 if it's Christmas Day or after Christmas in the current year
 */
export function getDaysUntilChristmas(date?: Date): number {
  const ukTime = date || getCurrentUKTime();
  const currentYear = getYear(ukTime);
  let christmasDay = getChristmasDay(currentYear);
  
  // If Christmas has passed this year, calculate for next year
  if (ukTime > christmasDay) {
    christmasDay = getChristmasDay(currentYear + 1);
  }
  
  const days = differenceInDays(christmasDay, ukTime);
  return Math.max(0, days);
}

/**
 * Check if Christmas curtains should be active
 * Active during December until Christmas Day (inclusive)
 */
export function shouldShowChristmasCurtains(date?: Date): boolean {
  const ukTime = date || getCurrentUKTime();
  
  // Not active in January
  if (isJanuary(ukTime)) {
    return false;
  }
  
  // Active during December until Christmas Day
  if (isDecember(ukTime)) {
    return !isChristmasDay(ukTime);
  }
  
  return false;
}

/**
 * Get Christmas feature state for the current time
 */
export interface ChristmasState {
  isChristmasActive: boolean;
  daysUntilChristmas: number;
  isChristmasDay: boolean;
  currentUKTime: Date;
}

export function getChristmasState(date?: Date): ChristmasState {
  const currentUKTime = date || getCurrentUKTime();
  
  return {
    isChristmasActive: shouldShowChristmasCurtains(currentUKTime),
    daysUntilChristmas: getDaysUntilChristmas(currentUKTime),
    isChristmasDay: isChristmasDay(currentUKTime),
    currentUKTime
  };
}