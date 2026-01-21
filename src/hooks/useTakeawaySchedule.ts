import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  checkRestaurantOpen,
  formatScheduleDisplay,
  getNextOpeningTime,
  formatNextOpening,
  type ScheduleStatus,
} from '@/utils/scheduleHelpers';

type OperatingHour = Database['public']['Tables']['restaurant_operating_hours']['Row'];
type ScheduleException = Database['public']['Tables']['restaurant_schedule_exceptions']['Row'];

export function useTakeawaySchedule(restaurantId: string, timezone: string = 'America/Buenos_Aires') {
  const [operatingHours, setOperatingHours] = useState<OperatingHour[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus>({
    isOpen: false,
    weeklySchedule: [],
    nextOpenTime: null,
    closureReason: null,
  });

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const fetchScheduleData = async () => {
      try {
        // Fetch operating hours
        const { data: hoursData, error: hoursError } = await supabase
          .from('restaurant_operating_hours')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .order('day_of_week');

        if (hoursError) throw hoursError;

        // Fetch exceptions
        const { data: exceptionsData, error: exceptionsError } = await supabase
          .from('restaurant_schedule_exceptions')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .gte('exception_date', new Date().toISOString().split('T')[0]); // Only future/today exceptions

        if (exceptionsError) throw exceptionsError;

        setOperatingHours(hoursData || []);
        setExceptions(exceptionsData || []);

        // Calculate schedule status (pass timezone so comparison is done in restaurant timezone)
        const openStatus = checkRestaurantOpen(hoursData || [], exceptionsData || [], timezone);
        const weeklySchedule = formatScheduleDisplay(hoursData || [], timezone);
        const nextOpen = getNextOpeningTime(hoursData || [], exceptionsData || [], timezone);
        const nextOpenFormatted = formatNextOpening(nextOpen, timezone);

        setScheduleStatus({
          isOpen: openStatus.isOpen,
          weeklySchedule,
          nextOpenTime: nextOpenFormatted,
          closureReason: openStatus.closureReason,
        });
      } catch (error) {
        console.error('Error fetching schedule data:', error);
        // If error fetching, default to closed
        setScheduleStatus({
          isOpen: false,
          weeklySchedule: [],
          nextOpenTime: null,
          closureReason: 'Error al cargar horarios',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchScheduleData();

    // Set up real-time subscriptions
    const hoursChannel = supabase
      .channel(`operating-hours-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_operating_hours',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          fetchScheduleData();
        }
      )
      .subscribe();

    const exceptionsChannel = supabase
      .channel(`schedule-exceptions-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_schedule_exceptions',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          fetchScheduleData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(hoursChannel);
      supabase.removeChannel(exceptionsChannel);
    };
  }, [restaurantId, timezone]);

  return {
    scheduleStatus,
    loading,
    operatingHours,
    exceptions,
  };
}

