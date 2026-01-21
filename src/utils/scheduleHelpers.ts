import type { Database } from '@/integrations/supabase/types';

type OperatingHour = Database['public']['Tables']['restaurant_operating_hours']['Row'];
type ScheduleException = Database['public']['Tables']['restaurant_schedule_exceptions']['Row'];

export interface ScheduleStatus {
  isOpen: boolean;
  weeklySchedule: WeeklySchedule[];
  nextOpenTime: string | null;
  closureReason: string | null;
}

export interface WeeklySchedule {
  dayOfWeek: number;
  dayName: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

const DAY_NAMES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado'
];

export function isWithinOperatingHours(
  currentTime: string,
  openTime: string,
  closeTime: string
): boolean {
  const current = timeToMinutes(currentTime);
  const open = timeToMinutes(openTime);
  const close = timeToMinutes(closeTime);

  if (close < open) {
    return current >= open || current < close;
  } else {
    return current >= open && current < close;
  }
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  return `${hours}:${minutes}`;
}

export function getNextOpeningTime(
  operatingHours: OperatingHour[],
  exceptions: ScheduleException[],
  timezone: string = 'America/Buenos_Aires'
): Date | null {
  if (operatingHours.length === 0) {
    return null;
  }

  const now = new Date();
  
  // Get current time in restaurant timezone
  const currentTimeLocal = now.toLocaleString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const [currentHour, currentMinute] = currentTimeLocal.split(':').map(Number);
  const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:00`;
  
  // Get current day of week in restaurant timezone
  const currentDateLocal = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const currentDayOfWeek = currentDateLocal.getDay();
  
  // Get today's date in restaurant timezone
  const todayLocal = currentDateLocal.toISOString().split('T')[0];

  for (let daysAhead = 0; daysAhead < 7; daysAhead++) {
    // Calculate the date in restaurant timezone
    const checkDateLocal = new Date(currentDateLocal);
    checkDateLocal.setDate(checkDateLocal.getDate() + daysAhead);
    const checkDayOfWeek = checkDateLocal.getDay();
    const checkDateString = checkDateLocal.toISOString().split('T')[0];

    const exception = exceptions.find(
      (ex) => ex.exception_date === checkDateString
    );

    if (exception) {
      if (exception.is_closed_all_day) {
        continue;
      }
      if (exception.open_time && exception.close_time) {
        // Convert UTC times to restaurant timezone
        const exceptionOpenLocal = utcTimeToLocalTime(timezone, exception.open_time);
        
        if (daysAhead === 0) {
          if (currentTime < `${exceptionOpenLocal}:00`) {
            // Create date in restaurant timezone, then convert to UTC Date object
            return createDateTimeInTimezone(checkDateLocal, exceptionOpenLocal, timezone);
          }
        } else {
          return createDateTimeInTimezone(checkDateLocal, exceptionOpenLocal, timezone);
        }
      }
    } else {
      const daySchedule = operatingHours.find(
        (oh) => oh.day_of_week === checkDayOfWeek
      );

      if (daySchedule && !daySchedule.is_closed) {
        // Convert UTC times to restaurant timezone
        const scheduleOpenLocal = utcTimeToLocalTime(timezone, daySchedule.open_time);
        
        if (daysAhead === 0) {
          if (currentTime < `${scheduleOpenLocal}:00`) {
            return createDateTimeInTimezone(checkDateLocal, scheduleOpenLocal, timezone);
          }
        } else {
          return createDateTimeInTimezone(checkDateLocal, scheduleOpenLocal, timezone);
        }
      }
    }
  }

  return null;
}

function createDateTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function createDateTimeUTC(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(date);
  result.setUTCHours(hours, minutes, 0, 0);
  return result;
}

// Create a Date object representing a local time in a specific timezone
// Returns a Date object that, when formatted in the target timezone, shows the specified time
function createDateTimeInTimezone(date: Date, localTime: string, timezone: string): Date {
  const [hours, minutes] = localTime.split(':').map(Number);
  
  // Create a date string in the target timezone
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // We need to find the UTC time that corresponds to this local time in the timezone
  // Strategy: create a date at this time, format it in UTC, and adjust
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
  
  // Create formatter for the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  // Find UTC time that formats to our target local time
  for (let testUtcHour = 0; testUtcHour < 24; testUtcHour++) {
    const testDate = new Date(Date.UTC(year, month, day, testUtcHour, minutes, 0, 0));
    const formatted = formatter.format(testDate);
    const [formattedHour, formattedMinute] = formatted.split(':').map(Number);
    
    if (formattedHour === hours && formattedMinute === minutes) {
      return testDate;
    }
  }
  
  // Fallback: use offset calculation
  const referenceDate = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
  const localNoonStr = referenceDate.toLocaleString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [localNoonHour] = localNoonStr.split(':').map(Number);
  const offsetHours = localNoonHour - 12;
  const utcHour = (hours - offsetHours + 24) % 24;
  
  return new Date(Date.UTC(year, month, day, utcHour, minutes, 0, 0));
}

export function formatScheduleDisplay(operatingHours: OperatingHour[], timezone: string = 'America/Buenos_Aires'): WeeklySchedule[] {
  const schedules: WeeklySchedule[] = [];

  for (let day = 0; day <= 6; day++) {
    const daySchedule = operatingHours.find((oh) => oh.day_of_week === day);

    if (daySchedule) {
      // Convert UTC times to restaurant timezone for display
      const openTimeLocal = utcTimeToLocalTime(timezone, daySchedule.open_time);
      const closeTimeLocal = utcTimeToLocalTime(timezone, daySchedule.close_time);
      
      schedules.push({
        dayOfWeek: day,
        dayName: DAY_NAMES[day],
        openTime: openTimeLocal,
        closeTime: closeTimeLocal,
        isClosed: daySchedule.is_closed || false,
      });
    } else {
      schedules.push({
        dayOfWeek: day,
        dayName: DAY_NAMES[day],
        openTime: '',
        closeTime: '',
        isClosed: true,
      });
    }
  }

  return schedules;
}

// Helper function to convert UTC time to local timezone
function utcTimeToLocalTime(timezone: string, utcTime: string | null | undefined): string {
  if (!utcTime || !timezone) return '';
  
  const [hourStr, minuteStr = '00'] = utcTime.split(':');
  if (!hourStr) return '';
  
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  
  if (Number.isNaN(hour) || Number.isNaN(minute)) return '';
  
  // Use today's date as reference for timezone conversion
  const today = new Date();
  const utcDate = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
    hour,
    minute,
    0,
    0
  ));
  
  // Convert to local timezone using Intl API (handles DST correctly)
  const localTimeStr = utcDate.toLocaleString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  // Extract HH:mm from the formatted string
  const [localHour, localMinute] = localTimeStr.split(':').map(Number);
  
  return `${localHour.toString().padStart(2, '0')}:${localMinute.toString().padStart(2, '0')}`;
}

export function formatNextOpening(nextOpenTime: Date | null, timezone: string = 'America/Buenos_Aires'): string | null {
  if (!nextOpenTime) {
    return null;
  }

  const now = new Date();
  const diffDays = Math.floor(
    (nextOpenTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Convert UTC time to restaurant timezone for display
  const localTime = nextOpenTime.toLocaleString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  // Get day name in restaurant timezone
  const localDate = new Date(nextOpenTime.toLocaleString('en-US', { timeZone: timezone }));
  const dayName = DAY_NAMES[localDate.getDay()];

  if (diffDays === 0) {
    return `Hoy a las ${localTime}`;
  } else if (diffDays === 1) {
    return `Mañana (${dayName}) a las ${localTime}`;
  } else {
    return `${dayName} a las ${localTime}`;
  }
}

export function checkRestaurantOpen(
  operatingHours: OperatingHour[],
  exceptions: ScheduleException[],
  timezone: string = 'America/Buenos_Aires'
): { isOpen: boolean; closureReason: string | null } {
  if (operatingHours.length === 0) {
    return {
      isOpen: false,
      closureReason: null,
    };
  }

  const now = new Date();
  
  // Get current time in restaurant timezone (not UTC)
  const currentTimeLocal = now.toLocaleString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const [currentHour, currentMinute, currentSecond] = currentTimeLocal.split(':').map(Number);
  const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:${currentSecond.toString().padStart(2, '0')}`;
  
  // Get current day of week in restaurant timezone
  const currentDateLocal = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const currentDayOfWeek = currentDateLocal.getDay();
  
  // Get today's date in restaurant timezone (YYYY-MM-DD)
  const todayLocal = currentDateLocal.toISOString().split('T')[0];

  // Check for exceptions (exception_date is stored as DATE, so we compare with local date)
  const todayException = exceptions.find((ex) => ex.exception_date === todayLocal);

  if (todayException) {
    if (todayException.is_closed_all_day) {
      return {
        isOpen: false,
        closureReason: todayException.reason || 'Cerrado por excepción',
      };
    }

    if (todayException.open_time && todayException.close_time) {
      // Convert UTC times from database to restaurant timezone for comparison
      const exceptionOpenLocal = utcTimeToLocalTime(timezone, todayException.open_time);
      const exceptionCloseLocal = utcTimeToLocalTime(timezone, todayException.close_time);
      
      const isOpen = isWithinOperatingHours(
        currentTime,
        `${exceptionOpenLocal}:00`,
        `${exceptionCloseLocal}:00`
      );
      return {
        isOpen,
        closureReason: isOpen ? null : todayException.reason || null,
      };
    }
  }

  const todaySchedule = operatingHours.find(
    (oh) => oh.day_of_week === currentDayOfWeek
  );

  if (!todaySchedule || todaySchedule.is_closed) {
    return {
      isOpen: false,
      closureReason: 'Cerrado los ' + DAY_NAMES[currentDayOfWeek] + 's',
    };
  }

  // Convert UTC times from database to restaurant timezone for comparison
  const scheduleOpenLocal = utcTimeToLocalTime(timezone, todaySchedule.open_time);
  const scheduleCloseLocal = utcTimeToLocalTime(timezone, todaySchedule.close_time);

  const isOpen = isWithinOperatingHours(
    currentTime,
    `${scheduleOpenLocal}:00`,
    `${scheduleCloseLocal}:00`
  );

  return {
    isOpen,
    closureReason: isOpen ? null : null,
  };
}

