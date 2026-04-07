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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_activity_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_email: string | null
          target_user_id: string | null
          target_user_name: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_email?: string | null
          target_user_id?: string | null
          target_user_name?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_email?: string | null
          target_user_id?: string | null
          target_user_name?: string | null
        }
        Relationships: []
      }
      dependents: {
        Row: {
          created_at: string | null
          date_of_birth: string | null
          family_id: string | null
          first_name: string
          id: string
          parent_id: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          date_of_birth?: string | null
          family_id?: string | null
          first_name: string
          id?: string
          parent_id?: string | null
          type?: string
        }
        Update: {
          created_at?: string | null
          date_of_birth?: string | null
          family_id?: string | null
          first_name?: string
          id?: string
          parent_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "dependents_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      event_sign_up_items: {
        Row: {
          created_at: string
          event_id: string
          id: number
          item_name: string
          order_index: number
          quantity_limit: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: never
          item_name: string
          order_index?: number
          quantity_limit?: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: never
          item_name?: string
          order_index?: number
          quantity_limit?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_sign_up_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          allows_potluck: boolean
          created_at: string
          display_order: number
          icon: string
          id: string
          is_virtual: boolean
          name: string
          requires_location: boolean
        }
        Insert: {
          allows_potluck?: boolean
          created_at?: string
          display_order?: number
          icon?: string
          id?: string
          is_virtual?: boolean
          name: string
          requires_location?: boolean
        }
        Update: {
          allows_potluck?: boolean
          created_at?: string
          display_order?: number
          icon?: string
          id?: string
          is_virtual?: boolean
          name?: string
          requires_location?: boolean
        }
        Relationships: []
      }
      events: {
        Row: {
          address: string | null
          capacity: number | null
          checkin_pin: string | null
          cover_photo_url: string | null
          created_at: string
          date_time: string
          description: string | null
          end_date_time: string | null
          event_type_id: string
          has_potluck: boolean | null
          host_id: string | null
          id: string
          is_hybrid: boolean
          location: string | null
          mureeds_only: boolean
          online_link: string | null
          payment_instructions: string | null
          status: Database["public"]["Enums"]["event_status"]
          ticket_fee: number | null
          title: string
          updated_at: string
          venue_id: string | null
          virtual_link: string | null
          waitlist_capacity: number
          zoom_link: string | null
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          checkin_pin?: string | null
          cover_photo_url?: string | null
          created_at?: string
          date_time: string
          description?: string | null
          end_date_time?: string | null
          event_type_id: string
          has_potluck?: boolean | null
          host_id?: string | null
          id?: string
          is_hybrid?: boolean
          location?: string | null
          mureeds_only?: boolean
          online_link?: string | null
          payment_instructions?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          ticket_fee?: number | null
          title: string
          updated_at?: string
          venue_id?: string | null
          virtual_link?: string | null
          waitlist_capacity?: number
          zoom_link?: string | null
        }
        Update: {
          address?: string | null
          capacity?: number | null
          checkin_pin?: string | null
          cover_photo_url?: string | null
          created_at?: string
          date_time?: string
          description?: string | null
          end_date_time?: string | null
          event_type_id?: string
          has_potluck?: boolean | null
          host_id?: string | null
          id?: string
          is_hybrid?: boolean
          location?: string | null
          mureeds_only?: boolean
          online_link?: string | null
          payment_instructions?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          ticket_fee?: number | null
          title?: string
          updated_at?: string
          venue_id?: string | null
          virtual_link?: string | null
          waitlist_capacity?: number
          zoom_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      family_invites: {
        Row: {
          created_at: string
          created_by: string
          family_id: string
          id: string
          status: Database["public"]["Enums"]["invite_status"]
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          family_id: string
          id?: string
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          family_id?: string
          id?: string
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_invites_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_requests: {
        Row: {
          created_at: string
          event_id: string
          guest_email: string
          guest_name: string
          guest_phone: string | null
          id: string
          requesting_user_id: string
          status: Database["public"]["Enums"]["guest_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          guest_email?: string
          guest_name: string
          guest_phone?: string | null
          id?: string
          requesting_user_id: string
          status?: Database["public"]["Enums"]["guest_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          guest_email?: string
          guest_name?: string
          guest_phone?: string | null
          id?: string
          requesting_user_id?: string
          status?: Database["public"]["Enums"]["guest_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      potluck_config: {
        Row: {
          category: Database["public"]["Enums"]["potluck_category"]
          created_at: string
          event_id: string
          id: string
          max_slots: number
        }
        Insert: {
          category: Database["public"]["Enums"]["potluck_category"]
          created_at?: string
          event_id: string
          id?: string
          max_slots?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["potluck_category"]
          created_at?: string
          event_id?: string
          id?: string
          max_slots?: number
        }
        Relationships: [
          {
            foreignKeyName: "potluck_config_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          alternate_cell_number: string | null
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          family_id: string | null
          family_name: string | null
          id: string
          is_mureed: boolean
          name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          terms_accepted: boolean | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          alternate_cell_number?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          family_id?: string | null
          family_name?: string | null
          id: string
          is_mureed?: boolean
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          terms_accepted?: boolean | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          alternate_cell_number?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          family_id?: string | null
          family_name?: string | null
          id?: string
          is_mureed?: boolean
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          terms_accepted?: boolean | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          category: string
          created_at: string
          description: string | null
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          resource_type: string
          title: string
          uploaded_by: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          resource_type?: string
          title: string
          uploaded_by: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          resource_type?: string
          title?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      rsvp_sign_up_selections: {
        Row: {
          created_at: string
          description: string | null
          id: number
          quantity: number
          rsvp_id: string
          sign_up_item_id: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: never
          quantity?: number
          rsvp_id: string
          sign_up_item_id: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: never
          quantity?: number
          rsvp_id?: string
          sign_up_item_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "rsvp_sign_up_selections_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: false
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvp_sign_up_selections_sign_up_item_id_fkey"
            columns: ["sign_up_item_id"]
            isOneToOne: false
            referencedRelation: "event_sign_up_items"
            referencedColumns: ["id"]
          },
        ]
      }
      rsvps: {
        Row: {
          attending_dependents: Json | null
          checked_in: boolean
          created_at: string
          event_id: string
          guests_count: number
          id: string
          is_waitlisted: boolean
          potluck_category:
            | Database["public"]["Enums"]["potluck_category"]
            | null
          qr_hash: string | null
          specific_food_item: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attending_dependents?: Json | null
          checked_in?: boolean
          created_at?: string
          event_id: string
          guests_count?: number
          id?: string
          is_waitlisted?: boolean
          potluck_category?:
            | Database["public"]["Enums"]["potluck_category"]
            | null
          qr_hash?: string | null
          specific_food_item?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attending_dependents?: Json | null
          checked_in?: boolean
          created_at?: string
          event_id?: string
          guests_count?: number
          id?: string
          is_waitlisted?: boolean
          potluck_category?:
            | Database["public"]["Enums"]["potluck_category"]
            | null
          qr_hash?: string | null
          specific_food_item?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_family_invite: { Args: { _token: string }; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_my_family_id: { Args: never; Returns: string }
      guest_has_rsvp: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "approved"
        | "guest"
        | "pending"
        | "suspended"
        | "rejected"
      event_status: "active" | "full" | "cancelled"
      guest_request_status: "pending" | "approved" | "rejected"
      invite_status: "pending" | "accepted" | "expired"
      potluck_category: "main" | "side" | "dessert" | "drinks"
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
    Enums: {
      app_role: [
        "admin",
        "moderator",
        "approved",
        "guest",
        "pending",
        "suspended",
        "rejected",
      ],
      event_status: ["active", "full", "cancelled"],
      guest_request_status: ["pending", "approved", "rejected"],
      invite_status: ["pending", "accepted", "expired"],
      potluck_category: ["main", "side", "dessert", "drinks"],
    },
  },
} as const
