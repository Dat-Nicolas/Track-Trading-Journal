import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';

const FIXED_OFFSET_REGEX = /^(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/i;

/**
 * Normalizes broker timezone string so Luxon accepts both:
 * - Standard IANA names: "Europe/Athens", "Europe/Helsinki", "Asia/Ho_Chi_Minh"
 * - Fixed offsets: "UTC+2", "UTC+3", "GMT+2", "UTC-5", "UTC+05:30"
 */
export function normalizeTimezoneZone(tz: string): string {
  const trimmed = tz.trim();
  if (!trimmed) return 'UTC';

  const fixedMatch = FIXED_OFFSET_REGEX.exec(trimmed);
  if (fixedMatch) {
    const sign = fixedMatch[1];
    const hours = fixedMatch[2].padStart(2, '0');
    const minutes = (fixedMatch[3] ?? '00').padStart(2, '0');
    return `UTC${sign}${hours}:${minutes}`;
  }

  if (trimmed.toUpperCase() === 'UTC' || trimmed.toUpperCase() === 'GMT') {
    return 'UTC';
  }

  return trimmed;
}

/**
 * Parses a broker server timestamp string (MT5 standard "YYYY.MM.DD HH:mm:ss",
 * "YYYY-MM-DD HH:mm:ss", or ISO-8601) into a UTC JavaScript Date using Luxon.
 *
 * If the string already contains an explicit timezone offset or trailing 'Z',
 * Luxon respects it directly; otherwise it interprets the wall clock time in `brokerTimezone`.
 */
export function parseBrokerTimeToUtc(timeStr: string, brokerTimezone: string): Date {
  const cleaned = timeStr.trim();
  if (!cleaned) {
    throw new BadRequestException('Timestamp cannot be empty');
  }

  const zone = normalizeTimezoneZone(brokerTimezone);

  // If ISO string already carries explicit Z or offset (+/-HH:mm), parse directly as UTC
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(cleaned)) {
    const isoDt = DateTime.fromISO(cleaned, { setZone: true });
    if (isoDt.isValid) {
      return isoDt.toUTC().toJSDate();
    }
  }

  const formats = [
    'yyyy.MM.dd HH:mm:ss',
    'yyyy.MM.dd HH:mm:ss.SSS',
    'yyyy.MM.dd HH:mm',
    'yyyy-MM-dd HH:mm:ss',
    'yyyy-MM-dd HH:mm:ss.SSS',
    'yyyy-MM-dd HH:mm',
    'dd.MM.yyyy HH:mm:ss',
    'MM/dd/yyyy HH:mm:ss',
  ];

  for (const fmt of formats) {
    const dt = DateTime.fromFormat(cleaned, fmt, { zone });
    if (dt.isValid) {
      return dt.toUTC().toJSDate();
    }
  }

  const fallbackIso = DateTime.fromISO(cleaned, { zone });
  if (fallbackIso.isValid) {
    return fallbackIso.toUTC().toJSDate();
  }

  throw new BadRequestException(
    `Invalid timestamp "${timeStr}" for brokerTimezone "${brokerTimezone}"`,
  );
}

/**
 * Parses a filter date string (`YYYY-MM-DD` or ISO) in the requested displayTimezone
 * to a UTC Date boundary (start of day or end of day).
 */
export function parseFilterDateToUtc(
  value: string,
  displayTimezone: string,
  boundary: 'start' | 'end',
): Date {
  const cleaned = value.trim();
  const zone = normalizeTimezoneZone(displayTimezone);

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const dt = DateTime.fromFormat(cleaned, 'yyyy-MM-dd', { zone });
    if (!dt.isValid) {
      throw new BadRequestException(`Invalid date filter: ${value}`);
    }
    return (boundary === 'start' ? dt.startOf('day') : dt.endOf('day')).toUTC().toJSDate();
  }

  const iso = DateTime.fromISO(cleaned, { zone });
  if (!iso.isValid) {
    throw new BadRequestException(`Invalid date filter: ${value}`);
  }
  return iso.toUTC().toJSDate();
}

export function getZonedDateTime(utcDate: Date, displayTimezone: string): DateTime {
  return DateTime.fromJSDate(utcDate, { zone: 'utc' }).setZone(
    normalizeTimezoneZone(displayTimezone),
  );
}
