import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'

type Tables = Database['public']['Tables']
type MenuItems = Tables['menu_items']['Row']
type Categories = Tables['categories']['Row']
type TableRow = Tables['tables']['Row']

export const useTableData = (tableQrId: string) => {
  const [table, setTable] = useState<TableRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTable = async () => {
      try {
        const { data, error } = await supabase
          .from('tables')
          .select('*')
          .eq('qr_code_id', tableQrId)
          .maybeSingle()

        if (error) throw error
        setTable(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching table')
      } finally {
        setLoading(false)
      }
    }

    if (tableQrId) {
      fetchTable()
    }
  }, [tableQrId])

  // Real-time subscription for table updates
  useEffect(() => {
    if (!tableQrId) return

    const channel = supabase
      .channel('table-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tables',
          filter: `qr_code_id=eq.${tableQrId}`
        },
        (payload) => {
          setTable(payload.new as TableRow)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tableQrId])

  return { table, loading, error }
}

export const useMenuData = (restaurantId: string) => {
  const [categories, setCategories] = useState<Categories[]>([])
  const [menuItems, setMenuItems] = useState<MenuItems[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMenuData = async () => {
      try {
        const [categoriesResponse, menuItemsResponse] = await Promise.all([
          supabase
            .from('categories')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('enabled', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('menu_items')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('available', true)
            .eq('enabled', true)
            .order('sort_order', { ascending: true })
        ])

        if (categoriesResponse.error) throw categoriesResponse.error
        if (menuItemsResponse.error) throw menuItemsResponse.error

        setCategories(categoriesResponse.data || [])
        setMenuItems(menuItemsResponse.data || [])
      } catch (error) {
        console.error('Error fetching menu data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (restaurantId) {
      fetchMenuData()
    }
  }, [restaurantId])

  // Real-time subscriptions for menu updates
  useEffect(() => {
    if (!restaurantId) return

    const categoriesChannel = supabase
      .channel('categories-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        () => {
          // Refetch categories when changes occur
          supabase
            .from('categories')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('enabled', true)
            .order('sort_order', { ascending: true })
            .then(({ data }) => setCategories(data || []))
        }
      )
      .subscribe()

    const menuItemsChannel = supabase
      .channel('menu-items-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_items',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        () => {
          // Refetch menu items when changes occur
          supabase
            .from('menu_items')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('available', true)
            .eq('enabled', true)
            .order('sort_order', { ascending: true })
            .then(({ data }) => setMenuItems(data || []))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(categoriesChannel)
      supabase.removeChannel(menuItemsChannel)
    }
  }, [restaurantId])

  return { categories, menuItems, loading }
}