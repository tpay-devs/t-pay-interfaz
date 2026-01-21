export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          name: string
          restaurant_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name: string
          restaurant_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string
          restaurant_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_extras: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string
          name: string
          price: number
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id: string
          name: string
          price?: number
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_extras_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_ingredients: {
        Row: {
          created_at: string
          id: string
          included_by_default: boolean
          menu_item_id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          included_by_default?: boolean
          menu_item_id: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          included_by_default?: boolean
          menu_item_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_ingredients_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          available: boolean | null
          category_id: string | null
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          image_url: string | null
          name: string
          price: number
          restaurant_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          available?: boolean | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          image_url?: string | null
          name: string
          price: number
          restaurant_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          available?: boolean | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          restaurant_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          order_id: string | null
          read: boolean | null
          restaurant_id: string
          table_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          order_id?: string | null
          read?: boolean | null
          restaurant_id: string
          table_id?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          order_id?: string | null
          read?: boolean | null
          restaurant_id?: string
          table_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_added_extras: {
        Row: {
          created_at: string
          extra_id: string
          id: string
          order_item_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          extra_id: string
          id?: string
          order_item_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          extra_id?: string
          id?: string
          order_item_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_order_item_added_extras_extra"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "menu_item_extras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_order_item_added_extras_order_item"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_removed_ingredients: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          order_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          order_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          order_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_order_item_removed_ingredients_ingredient"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "menu_item_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_order_item_removed_ingredients_order_item"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string
          order_id: string
          quantity: number
          special_instructions: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id: string
          order_id: string
          quantity?: number
          special_instructions?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string
          order_id?: string
          quantity?: number
          special_instructions?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_session_id: string | null
          created_at: string
          id: string
          mercadopago_collection_id: string | null
          mercadopago_payment_id: string | null
          mercadopago_payment_method: string | null
          mercadopago_preference_id: string | null
          notes: string | null
          order_number: number
          pickup_code: string | null
          payer_email: string | null
          payer_name: string | null
          payment_method: string | null
          payment_status: string | null
          pickup_time: string | null
          restaurant_id: string
          status: string | null
          table_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          client_session_id?: string | null
          created_at?: string
          id?: string
          mercadopago_collection_id?: string | null
          mercadopago_payment_id?: string | null
          mercadopago_payment_method?: string | null
          mercadopago_preference_id?: string | null
          notes?: string | null
          order_number?: number
          pickup_code?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pickup_time?: string | null
          restaurant_id: string
          status?: string | null
          table_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          client_session_id?: string | null
          created_at?: string
          id?: string
          mercadopago_collection_id?: string | null
          mercadopago_payment_id?: string | null
          mercadopago_payment_method?: string | null
          mercadopago_preference_id?: string | null
          notes?: string | null
          order_number?: number
          pickup_code?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pickup_time?: string | null
          restaurant_id?: string
          status?: string | null
          table_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
            onDelete: "CASCADE"
            onUpdate: "NO ACTION"
          },
        ]
      }
      restaurant_operating_hours: {
        Row: {
          close_time: string
          created_at: string
          day_of_week: number
          id: string
          is_closed: boolean | null
          open_time: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          close_time: string
          created_at?: string
          day_of_week: number
          id?: string
          is_closed?: boolean | null
          open_time: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          close_time?: string
          created_at?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean | null
          open_time?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_operating_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_schedule_exceptions: {
        Row: {
          close_time: string | null
          created_at: string
          exception_date: string
          id: string
          is_closed_all_day: boolean | null
          open_time: string | null
          reason: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          close_time?: string | null
          created_at?: string
          exception_date: string
          id?: string
          is_closed_all_day?: boolean | null
          open_time?: string | null
          reason?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          close_time?: string | null
          created_at?: string
          exception_date?: string
          id?: string
          is_closed_all_day?: boolean | null
          open_time?: string | null
          reason?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_schedule_exceptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          commission_percentage: number | null
          cover_image_url: string | null
          created_at: string
          cuit: string | null
          email: string | null
          id: string
          logo_url: string | null
          mercadopago_access_token: string | null
          mercadopago_public_key: string | null
          mercadopago_sandbox_mode: boolean | null
          mercadopago_user_id: string | null
          name: string
          operation_mode: string | null
          payment_link: string | null
          phone: string | null
          primary_color: string | null
          template_style: string | null
          updated_at: string
          user_id: string
          welcome_message: string | null
        }
        Insert: {
          address?: string | null
          commission_percentage?: number | null
          cover_image_url?: string | null
          created_at?: string
          cuit?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          mercadopago_access_token?: string | null
          mercadopago_public_key?: string | null
          mercadopago_sandbox_mode?: boolean | null
          mercadopago_user_id?: string | null
          name: string
          operation_mode?: string | null
          payment_link?: string | null
          phone?: string | null
          primary_color?: string | null
          template_style?: string | null
          updated_at?: string
          user_id: string
          welcome_message?: string | null
        }
        Update: {
          address?: string | null
          commission_percentage?: number | null
          cover_image_url?: string | null
          created_at?: string
          cuit?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          mercadopago_access_token?: string | null
          mercadopago_public_key?: string | null
          mercadopago_sandbox_mode?: boolean | null
          mercadopago_user_id?: string | null
          name?: string
          operation_mode?: string | null
          payment_link?: string | null
          phone?: string | null
          primary_color?: string | null
          template_style?: string | null
          updated_at?: string
          user_id?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      tables: {
        Row: {
          capacity: number
          created_at: string
          id: string
          qr_active: boolean | null
          qr_code_id: string
          restaurant_id: string
          table_number: number
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          id?: string
          qr_active?: boolean | null
          qr_code_id: string
          restaurant_id: string
          table_number: number
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          qr_active?: boolean | null
          qr_code_id?: string
          restaurant_id?: string
          table_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          action: string | null
          body: Json | null
          created_at: string
          event_type: string | null
          external_reference: string | null
          http_status: number | null
          id: string
          live_mode: boolean
          merchant_order_id: string | null
          order_id: string | null
          payment_id: string | null
          processed: boolean
          processing_notes: string | null
          provider: string
          restaurant_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          body?: Json | null
          created_at?: string
          event_type?: string | null
          external_reference?: string | null
          http_status?: number | null
          id?: string
          live_mode?: boolean
          merchant_order_id?: string | null
          order_id?: string | null
          payment_id?: string | null
          processed?: boolean
          processing_notes?: string | null
          provider: string
          restaurant_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          body?: Json | null
          created_at?: string
          event_type?: string | null
          external_reference?: string | null
          http_status?: number | null
          id?: string
          live_mode?: boolean
          merchant_order_id?: string | null
          order_id?: string | null
          payment_id?: string | null
          processed?: boolean
          processing_notes?: string | null
          provider?: string
          restaurant_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_otp_codes: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_qr_code_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_next_order_number: {
        Args: { restaurant_uuid: string }
        Returns: number
      }
      get_restaurant_public_info: {
        Args: { restaurant_id_param?: string }
        Returns: {
          address: string
          cover_image_url: string
          created_at: string
          id: string
          logo_url: string
          name: string
          operation_mode: string
          primary_color: string
          template_style: string
          welcome_message: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
