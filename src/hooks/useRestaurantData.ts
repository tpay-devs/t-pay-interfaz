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
        console.log('Fetching restaurant data for ID:', restaurantId)
        
        const { data, error: rpcError } = await supabase
          .rpc('get_restaurant_public_info', { 
            restaurant_id_param: restaurantId 
          })

        console.log('RPC response:', { data, rpcError })

        if (rpcError) {
          console.error('RPC error:', rpcError)
          throw rpcError
        }
        
        if (data && data.length > 0) {
          console.log('Restaurant data loaded:', data[0])
          setRestaurant(data[0])
          setError(null)
        } else {
          console.log('No restaurant data returned')
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

