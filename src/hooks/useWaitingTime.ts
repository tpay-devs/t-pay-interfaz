import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

interface WaitingStatus {
  restaurant_id: string
  current_waiting_time_min: number | null
  current_waiting_time_max: number | null
  active_rule_id: string | null
  last_calculated_at: string | null
  updated_at: string
}

interface WaitingTimeData {
  minTime: number | null
  maxTime: number | null
  hasWaitingTime: boolean
  displayText: string
}

export const useWaitingTime = (restaurantId: string): WaitingTimeData => {
  const [waitingStatus, setWaitingStatus] = useState<WaitingStatus | null>(null)

  useEffect(() => {
    const fetchWaitingTime = async () => {
      if (!restaurantId) return

      try {
        const { data, error } = await supabase.rpc('get_restaurant_public_info', {
          restaurant_id_param: restaurantId
        })

        if (error) throw error

        const { data: waitingData, error: waitingError } = await supabase
          .from('restaurant_waiting_status' as any)
          .select('*')
          .eq('restaurant_id', restaurantId)
          .maybeSingle()

        if (waitingError) {
          console.log('No waiting time data available')
          setWaitingStatus(null)
        } else {
          setWaitingStatus(waitingData ? waitingData as unknown as WaitingStatus : null)
        }
      } catch (error) {
        console.error('Error fetching waiting time:', error)
        setWaitingStatus(null)
      }
    }

    fetchWaitingTime()
  }, [restaurantId])

  useEffect(() => {
    if (!restaurantId) return

    const channel = supabase
      .channel('waiting-time-changes')
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_waiting_status',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        (payload: any) => {
          if (payload.eventType === 'DELETE') {
            setWaitingStatus(null)
          } else {
            setWaitingStatus(payload.new as WaitingStatus)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId])

  const formatWaitingTime = (status: WaitingStatus | null): WaitingTimeData => {
    if (!status || (!status.current_waiting_time_min && !status.current_waiting_time_max)) {
      return {
        minTime: null,
        maxTime: null,
        hasWaitingTime: false,
        displayText: ''
      }
    }

    const minTime = status.current_waiting_time_min
    const maxTime = status.current_waiting_time_max

    let displayText = ''
    if (minTime && maxTime && minTime !== maxTime) {
      displayText = `${minTime}-${maxTime} min`
    } else if (minTime) {
      displayText = `~${minTime} min`
    } else if (maxTime) {
      displayText = `~${maxTime} min`
    }

    return {
      minTime,
      maxTime,
      hasWaitingTime: !!displayText,
      displayText
    }
  }

  return formatWaitingTime(waitingStatus)
}