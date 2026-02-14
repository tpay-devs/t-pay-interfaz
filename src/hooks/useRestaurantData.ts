import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'

type Restaurants = Database['public']['Tables']['restaurants']['Row']

export const useRestaurantData = (restaurantId: string) => {
  const [restaurant, setRestaurant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRestaurant = async () => {
      if (!restaurantId) {
        setLoading(false)
        return
      }

      try {

        const { data, error: rpcError } = await supabase
          .rpc('get_restaurant_public_info', {
            restaurant_id_param: restaurantId
          })


        if (rpcError) {
          console.error('RPC error:', rpcError)
          throw rpcError
        }

        if (data && data.length > 0) {
          setRestaurant(data[0])
          setError(null)
        } else {
          setError('Restaurant not found')
          setRestaurant(null)
        }
      } catch (err) {
        console.error('Error fetching restaurant:', err)
        setError(err instanceof Error ? err.message : 'Error fetching restaurant')
        setRestaurant(null)
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurant()
  }, [restaurantId])

  return { restaurant, loading, error }
}

