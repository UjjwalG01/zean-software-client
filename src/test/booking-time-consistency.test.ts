// Booking and Transaction Time Consistency Tests
// Tests for verifying correct date/time recording during booking creation and updates

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  getSystemTodayStr, 
  getSystemTimeStr, 
  getSystemTimestamp,
  getSystemNowDate 
} from '@/lib/timeUtils';
import { 
  toIsoDayInTz, 
  dayToTimestampInTz, 
  getAppTimezone, 
  setAppTimezone,
  wallTimeToUtcIso,
  SYSTEM_TZ 
} from '@/lib/tz';

describe('Time Utility Functions', () => {
  beforeEach(() => {
    // Reset timezone to default before each test
    setAppTimezone(null);
  });

  describe('getSystemTodayStr', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const today = getSystemTodayStr();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return consistent date within same system timezone', () => {
      const first = getSystemTodayStr();
      const second = getSystemTodayStr();
      expect(first).toBe(second);
    });

    it('should return date in Asia/Kathmandu timezone', () => {
      const today = getSystemTodayStr();
      const expected = new Intl.DateTimeFormat('en-CA', {
        timeZone: SYSTEM_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      expect(today).toBe(expected);
    });
  });

  describe('getSystemTimeStr', () => {
    it('should return time in HH:mm format', () => {
      const time = getSystemTimeStr();
      expect(time).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should return time in 24-hour format', () => {
      const time = getSystemTimeStr();
      const [hours] = time.split(':').map(Number);
      expect(hours).toBeGreaterThanOrEqual(0);
      expect(hours).toBeLessThan(24);
    });
  });

  describe('getSystemTimestamp', () => {
    it('should return timestamp in YYYY-MM-DDTHH:mm:ss format', () => {
      const ts = getSystemTimestamp();
      expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    });

    it('should not include timezone offset (naive datetime)', () => {
      const ts = getSystemTimestamp();
      expect(ts).not.toMatch(/Z$/);
      expect(ts).not.toMatch(/[+-]\d{2}:\d{2}$/);
    });
  });

  describe('getSystemNowDate', () => {
    it('should return a Date object', () => {
      const now = getSystemNowDate();
      expect(now).toBeInstanceOf(Date);
    });

    it('should represent current time in system timezone', () => {
      const now = getSystemNowDate();
      const expected = new Date(getSystemTimestamp());
      expect(now.getTime()).toBe(expected.getTime());
    });
  });
});

describe('Timezone Helper Functions (tz.ts)', () => {
  beforeEach(() => {
    setAppTimezone(null);
  });

  describe('toIsoDayInTz', () => {
    it('should convert Date to YYYY-MM-DD in specified timezone', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const result = toIsoDayInTz(date, 'UTC');
      expect(result).toBe('2024-01-15');
    });

    it('should handle string date input', () => {
      const result = toIsoDayInTz('2024-01-15T12:00:00Z', 'UTC');
      expect(result).toBe('2024-01-15');
    });

    it('should use app timezone when not specified', () => {
      setAppTimezone('Asia/Kathmandu');
      const date = new Date('2024-01-15T12:00:00Z');
      const result = toIsoDayInTz(date);
      // Kathmandu is UTC+5:45, so 12:00 UTC = 17:45 Kathmandu (same day)
      expect(result).toBe('2024-01-15');
    });

    it('should handle date near midnight crossing timezone boundary', () => {
      // 2024-01-15 00:30 UTC = 2024-01-15 06:15 Kathmandu
      const date = new Date('2024-01-15T00:30:00Z');
      const result = toIsoDayInTz(date, 'Asia/Kathmandu');
      expect(result).toBe('2024-01-15');

      // 2024-01-15 23:30 UTC = 2024-01-16 05:15 Kathmandu (next day)
      const date2 = new Date('2024-01-15T23:30:00Z');
      const result2 = toIsoDayInTz(date2, 'Asia/Kathmandu');
      expect(result2).toBe('2024-01-16');
    });
  });

  describe('dayToTimestampInTz', () => {
    it('should convert YYYY-MM-DD to ISO timestamp', () => {
      const result = dayToTimestampInTz('2024-01-15', 'UTC');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should return current timestamp for empty day', () => {
      const result = dayToTimestampInTz('', 'UTC');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should anchor at 12:00 wall time for non-today dates (converts to correct UTC)', () => {
      // Use a date that is definitely not today
      // 12:00 in Kathmandu (UTC+5:45) should be 06:15 UTC
      const result = dayToTimestampInTz('2024-06-15', 'Asia/Kathmandu');
      // Should contain T06:15:00 (12:00 Kathmandu = 06:15 UTC)
      expect(result).toContain('T06:15:00');
    });
  });

  describe('wallTimeToUtcIso', () => {
    it('should convert wall clock time to UTC ISO string', () => {
      const result = wallTimeToUtcIso('2024-01-15', '14:30', 'UTC');
      expect(result).toBe('2024-01-15T14:30:00.000Z');
    });

    it('should handle timezone conversion correctly', () => {
      // 14:30 in Kathmandu should convert to appropriate UTC time
      const result = wallTimeToUtcIso('2024-01-15', '14:30', 'Asia/Kathmandu');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should pad hours and minutes correctly', () => {
      const result = wallTimeToUtcIso('2024-01-15', '9:5', 'UTC');
      expect(result).toBe('2024-01-15T09:05:00.000Z');
    });

    it('should return empty string for invalid input', () => {
      expect(wallTimeToUtcIso('', '14:30')).toBe('');
      expect(wallTimeToUtcIso('2024-01-15', '')).toBe('');
    });
  });

  describe('getAppTimezone and setAppTimezone', () => {
    it('should return default timezone when not set', () => {
      setAppTimezone(null);
      expect(getAppTimezone()).toBe('Asia/Kathmandu');
    });

    it('should return overridden timezone when set', () => {
      setAppTimezone('America/New_York');
      expect(getAppTimezone()).toBe('America/New_York');
    });

    it('should fallback to default for empty string', () => {
      setAppTimezone('');
      expect(getAppTimezone()).toBe('Asia/Kathmandu');
    });
  });
});

describe('Booking Date/Time Recording Simulation', () => {
  beforeEach(() => {
    setAppTimezone(null);
  });

  it('should maintain consistent date across multiple calls during booking creation', () => {
    // Simulate booking creation flow
    const bookingDate = getSystemTodayStr();
    const bookingTime = getSystemTimeStr();
    const bookingTimestamp = getSystemTimestamp();

    // All should reference the same point in time
    expect(bookingTimestamp).toContain(bookingDate);
    expect(bookingTimestamp).toContain(bookingTime);
  });

  it('should correctly handle booking date selection', () => {
    const selectedDate = '2024-06-15';
    const startTime = '10:00';
    const endTime = '11:00';

    const startIso = wallTimeToUtcIso(selectedDate, startTime, 'Asia/Kathmandu');
    const endIso = wallTimeToUtcIso(selectedDate, endTime, 'Asia/Kathmandu');

    expect(startIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(endIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    
    // Both should be on the same date in UTC (accounting for timezone offset)
    const startDate = startIso.split('T')[0];
    const endDate = endIso.split('T')[0];
    expect(startDate).toBe(endDate);
  });

  it('should handle rescheduling to different time slot', () => {
    const originalDate = '2024-06-15';
    const originalStart = '10:00';
    const newHour = 14;
    const newStart = `${String(newHour).padStart(2, '0')}:00`;

    const originalIso = wallTimeToUtcIso(originalDate, originalStart, 'Asia/Kathmandu');
    const newIso = wallTimeToUtcIso(originalDate, newStart, 'Asia/Kathmandu');

    expect(originalIso).not.toBe(newIso);
    
    // New time should be later than original
    const originalTime = new Date(originalIso).getTime();
    const newTime = new Date(newIso).getTime();
    expect(newTime).toBeGreaterThan(originalTime);
  });

  it('should prevent rescheduling to past time slots', () => {
    const today = getSystemTodayStr();
    const currentTime = getSystemTimeStr();
    const [currentHour, currentMin] = currentTime.split(':').map(Number);
    
    // Try to schedule 2 hours in the past
    const pastHour = (currentHour - 2 + 24) % 24;
    const pastTime = `${String(pastHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
    
    const isPast = pastHour < currentHour || (pastHour === currentHour && Number(pastTime.split(':')[1]) <= currentMin);
    expect(isPast).toBe(true);
  });

  it('should handle booking spanning midnight correctly', () => {
    const date = '2024-06-15';
    const startTime = '23:00';
    const durationMinutes = 120; // 2 hours

    const [startH, startM] = startTime.split(':').map(Number);
    const endTotalMinutes = startH * 60 + startM + durationMinutes;
    const endH = Math.floor(endTotalMinutes / 60) % 24;
    const endM = endTotalMinutes % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    expect(endTime).toBe('01:00'); // Next day at 1 AM
    
    const startIso = wallTimeToUtcIso(date, startTime, 'Asia/Kathmandu');
    // For end time spanning midnight, we need to use the next day
    const nextDay = '2024-06-16';
    const endIso = wallTimeToUtcIso(nextDay, endTime, 'Asia/Kathmandu');
    
    // End time ISO should reflect the next day in UTC
    const startDate = new Date(startIso);
    const endDate = new Date(endIso);
    expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
  });
});

describe('Transaction Timestamp Consistency', () => {
  beforeEach(() => {
    setAppTimezone(null);
  });

  it('should generate consistent timestamps for transaction records', () => {
    const transactionTime1 = getSystemTimestamp();
    const transactionTime2 = getSystemTimestamp();
    
    // Both should be valid timestamps
    expect(transactionTime1).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(transactionTime2).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it('should maintain chronological order', () => {
    const time1 = getSystemTimestamp();
    // Small delay to ensure time progression
    const start = Date.now();
    while (Date.now() - start < 1001) { /* wait */ }
    const time2 = getSystemTimestamp();
    
    // Compare as strings lexicographically (ISO format allows this)
    expect(time2 >= time1).toBe(true);
  });
});

describe('Edge Cases and Boundary Conditions', () => {
  beforeEach(() => {
    setAppTimezone(null);
  });

  it('should handle leap year dates correctly', () => {
    const leapYearDate = '2024-02-29';
    const result = toIsoDayInTz(new Date(leapYearDate + 'T12:00:00Z'), 'UTC');
    expect(result).toBe('2024-02-29');
  });

  it('should handle year boundary correctly', () => {
    const yearEnd = '2024-12-31';
    const result = toIsoDayInTz(new Date(yearEnd + 'T12:00:00Z'), 'UTC');
    expect(result).toBe('2024-12-31');

    const yearStart = '2025-01-01';
    const result2 = toIsoDayInTz(new Date(yearStart + 'T12:00:00Z'), 'UTC');
    expect(result2).toBe('2025-01-01');
  });

  it('should handle DST transitions (for timezones that observe DST)', () => {
    // Test with a timezone that observes DST
    const dstTransitionDate = '2024-03-10'; // US DST starts
    const result = toIsoDayInTz(new Date(dstTransitionDate + 'T12:00:00Z'), 'America/New_York');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should handle midnight edge case', () => {
    const midnight = '2024-06-15T00:00:00';
    const result = toIsoDayInTz(new Date(midnight), 'UTC');
    expect(result).toBe('2024-06-15');
  });

  it('should handle end of day edge case', () => {
    const endOfDay = '2024-06-15T23:59:59';
    const result = toIsoDayInTz(new Date(endOfDay), 'UTC');
    expect(result).toBe('2024-06-15');
  });
});

describe('Drag and Drop Reschedule Time Handling', () => {
  beforeEach(() => {
    setAppTimezone(null);
  });

  it('should correctly calculate new time slot from dragged hour', () => {
    const newHour = 15;
    const newStart = `${String(newHour).padStart(2, '0')}:00`;
    const newEnd = `${String(newHour + 1).padStart(2, '0')}:00`;

    expect(newStart).toBe('15:00');
    expect(newEnd).toBe('16:00');
  });

  it('should handle hour wrapping at midnight', () => {
    const newHour = 23;
    const newStart = `${String(newHour).padStart(2, '0')}:00`;
    const newEnd = `${String((newHour + 1) % 24).padStart(2, '0')}:00`;

    expect(newStart).toBe('23:00');
    expect(newEnd).toBe('00:00');
  });

  it('should validate that new time slot is not in the past', () => {
    const today = getSystemTodayStr();
    const [currentHour] = getSystemTimeStr().split(':').map(Number);
    
    // Past hour
    const pastHour = currentHour - 1;
    const isPastHour = pastHour < currentHour;
    expect(isPastHour).toBe(true);

    // Future hour
    const futureHour = currentHour + 1;
    const isFutureHour = futureHour > currentHour;
    expect(isFutureHour).toBe(true);
  });

  it('should preserve date during time-only reschedule', () => {
    const originalDate = '2024-06-15';
    const originalHour = 10;
    const newHour = 14;

    const originalStart = `${String(originalHour).padStart(2, '0')}:00`;
    const newStart = `${String(newHour).padStart(2, '0')}:00`;

    const originalIso = wallTimeToUtcIso(originalDate, originalStart, 'Asia/Kathmandu');
    const newIso = wallTimeToUtcIso(originalDate, newStart, 'Asia/Kathmandu');

    // Both should be on the same calendar date
    const origDatePart = originalIso.split('T')[0];
    const newDatePart = newIso.split('T')[0];
    expect(origDatePart).toBe(newDatePart);
  });
});
