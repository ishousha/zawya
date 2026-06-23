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
      announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          ends_at: string | null
          id: string
          link_label: string | null
          link_url: string | null
          message: string
          starts_at: string
          title: string
          updated_at: string
          variant: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          ends_at?: string | null
          id?: string
          link_label?: string | null
          link_url?: string | null
          message: string
          starts_at?: string
          title: string
          updated_at?: string
          variant?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          link_label?: string | null
          link_url?: string | null
          message?: string
          starts_at?: string
          title?: string
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      deliverability_checks: {
        Row: {
          alignment: Json
          checked_at: string
          dmarc_org_present: boolean
          dmarc_policy: string | null
          id: string
          root: Json
          sender: Json
          source: string
        }
        Insert: {
          alignment: Json
          checked_at?: string
          dmarc_org_present?: boolean
          dmarc_policy?: string | null
          id?: string
          root: Json
          sender: Json
          source?: string
        }
        Update: {
          alignment?: Json
          checked_at?: string
          dmarc_org_present?: boolean
          dmarc_policy?: string | null
          id?: string
          root?: Json
          sender?: Json
          source?: string
        }
        Relationships: []
      }
      dependents: {
        Row: {
          age_group: string | null
          created_at: string | null
          date_of_birth: string | null
          family_id: string | null
          first_name: string
          gender: string | null
          id: string
          parent_id: string | null
          type: string
          type_other: string | null
        }
        Insert: {
          age_group?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          family_id?: string | null
          first_name: string
          gender?: string | null
          id?: string
          parent_id?: string | null
          type?: string
          type_other?: string | null
        }
        Update: {
          age_group?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          family_id?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          parent_id?: string | null
          type?: string
          type_other?: string | null
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
      event_reminders_sent: {
        Row: {
          event_id: string
          id: string
          reminder_type: string
          sent_at: string
        }
        Insert: {
          event_id: string
          id?: string
          reminder_type?: string
          sent_at?: string
        }
        Update: {
          event_id?: string
          id?: string
          reminder_type?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reminders_sent_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
      event_speakers: {
        Row: {
          created_at: string
          display_order: number
          event_id: string
          id: string
          speaker_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          event_id: string
          id?: string
          speaker_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          event_id?: string
          id?: string
          speaker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_speakers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_speakers_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "speakers"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          allows_potluck: boolean
          created_at: string
          default_age_group: string
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
          default_age_group?: string
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
          default_age_group?: string
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
          age_group: string
          age_groups: string[]
          allow_guests: boolean
          announcement_send_at: string | null
          announcement_sent_at: string | null
          audience_gender: string
          capacity: number | null
          checkin_pin: string | null
          checkin_radius_meters: number
          cover_photo_url: string | null
          created_at: string
          date_time: string
          description: string | null
          end_date_time: string | null
          etiquette_notes: string | null
          event_type_id: string
          has_potluck: boolean | null
          host_id: string | null
          id: string
          is_hybrid: boolean
          last_published_at: string | null
          latitude: number | null
          location: string | null
          location_hint: string | null
          longitude: number | null
          maps_url: string | null
          mureeds_only: boolean
          online_link: string | null
          payment_instructions: string | null
          published: boolean
          recording_passcode: string | null
          recording_url: string | null
          scheduled_publish_at: string | null
          short_code: string
          status: Database["public"]["Enums"]["event_status"]
          ticket_fee: number | null
          title: string
          updated_at: string
          venue_id: string | null
          virtual_link: string | null
          waitlist_capacity: number
          zoom_link: string | null
          zoom_password: string | null
        }
        Insert: {
          address?: string | null
          age_group?: string
          age_groups?: string[]
          allow_guests?: boolean
          announcement_send_at?: string | null
          announcement_sent_at?: string | null
          audience_gender?: string
          capacity?: number | null
          checkin_pin?: string | null
          checkin_radius_meters?: number
          cover_photo_url?: string | null
          created_at?: string
          date_time: string
          description?: string | null
          end_date_time?: string | null
          etiquette_notes?: string | null
          event_type_id: string
          has_potluck?: boolean | null
          host_id?: string | null
          id?: string
          is_hybrid?: boolean
          last_published_at?: string | null
          latitude?: number | null
          location?: string | null
          location_hint?: string | null
          longitude?: number | null
          maps_url?: string | null
          mureeds_only?: boolean
          online_link?: string | null
          payment_instructions?: string | null
          published?: boolean
          recording_passcode?: string | null
          recording_url?: string | null
          scheduled_publish_at?: string | null
          short_code: string
          status?: Database["public"]["Enums"]["event_status"]
          ticket_fee?: number | null
          title: string
          updated_at?: string
          venue_id?: string | null
          virtual_link?: string | null
          waitlist_capacity?: number
          zoom_link?: string | null
          zoom_password?: string | null
        }
        Update: {
          address?: string | null
          age_group?: string
          age_groups?: string[]
          allow_guests?: boolean
          announcement_send_at?: string | null
          announcement_sent_at?: string | null
          audience_gender?: string
          capacity?: number | null
          checkin_pin?: string | null
          checkin_radius_meters?: number
          cover_photo_url?: string | null
          created_at?: string
          date_time?: string
          description?: string | null
          end_date_time?: string | null
          etiquette_notes?: string | null
          event_type_id?: string
          has_potluck?: boolean | null
          host_id?: string | null
          id?: string
          is_hybrid?: boolean
          last_published_at?: string | null
          latitude?: number | null
          location?: string | null
          location_hint?: string | null
          longitude?: number | null
          maps_url?: string | null
          mureeds_only?: boolean
          online_link?: string | null
          payment_instructions?: string | null
          published?: boolean
          recording_passcode?: string | null
          recording_url?: string | null
          scheduled_publish_at?: string | null
          short_code?: string
          status?: Database["public"]["Enums"]["event_status"]
          ticket_fee?: number | null
          title?: string
          updated_at?: string
          venue_id?: string | null
          virtual_link?: string | null
          waitlist_capacity?: number
          zoom_link?: string | null
          zoom_password?: string | null
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
      external_guests: {
        Row: {
          created_at: string
          email: string | null
          id: string
          last_attended_at: string | null
          last_invited_at: string | null
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          times_approved: number
          times_attended: number
          times_invited: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          last_attended_at?: string | null
          last_invited_at?: string | null
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          times_approved?: number
          times_attended?: number
          times_invited?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          last_attended_at?: string | null
          last_invited_at?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          times_approved?: number
          times_attended?: number
          times_invited?: number
          updated_at?: string
        }
        Relationships: []
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
      guest_list_reminders_sent: {
        Row: {
          event_id: string
          id: string
          sent_at: string
          trigger_type: string
        }
        Insert: {
          event_id: string
          id?: string
          sent_at?: string
          trigger_type?: string
        }
        Update: {
          event_id?: string
          id?: string
          sent_at?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_list_reminders_sent_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_requests: {
        Row: {
          created_at: string
          event_id: string
          external_guest_id: string | null
          guest_email: string
          guest_name: string
          guest_phone: string | null
          id: string
          member_note: string | null
          requesting_user_id: string
          status: Database["public"]["Enums"]["guest_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          external_guest_id?: string | null
          guest_email?: string
          guest_name: string
          guest_phone?: string | null
          id?: string
          member_note?: string | null
          requesting_user_id: string
          status?: Database["public"]["Enums"]["guest_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          external_guest_id?: string | null
          guest_email?: string
          guest_name?: string
          guest_phone?: string | null
          id?: string
          member_note?: string | null
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
          {
            foreignKeyName: "guest_requests_external_guest_id_fkey"
            columns: ["external_guest_id"]
            isOneToOne: false
            referencedRelation: "external_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_requests_requesting_user_id_fkey"
            columns: ["requesting_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          gender: string | null
          id: string
          is_mureed: boolean
          name: string | null
          notification_preferences: Json
          onboarding_completed: boolean
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
          gender?: string | null
          id: string
          is_mureed?: boolean
          name?: string | null
          notification_preferences?: Json
          onboarding_completed?: boolean
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
          gender?: string | null
          id?: string
          is_mureed?: boolean
          name?: string | null
          notification_preferences?: Json
          onboarding_completed?: boolean
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
          cover_image_url: string | null
          created_at: string
          description: string | null
          event_id: string | null
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          resource_date: string | null
          resource_type: string
          short_code: string | null
          speaker_ids: string[]
          tags: string[]
          title: string
          uploaded_by: string
        }
        Insert: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          event_id?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          resource_date?: string | null
          resource_type?: string
          short_code?: string | null
          speaker_ids?: string[]
          tags?: string[]
          title: string
          uploaded_by: string
        }
        Update: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          event_id?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          resource_date?: string | null
          resource_type?: string
          short_code?: string | null
          speaker_ids?: string[]
          tags?: string[]
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
          status: Database["public"]["Enums"]["rsvp_status"]
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
          status?: Database["public"]["Enums"]["rsvp_status"]
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
          status?: Database["public"]["Enums"]["rsvp_status"]
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
      speakers: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          image_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
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
          area_hint: string | null
          created_at: string | null
          default_host_id: string | null
          id: string
          maps_url: string | null
          name: string
        }
        Insert: {
          address?: string | null
          area_hint?: string | null
          created_at?: string | null
          default_host_id?: string | null
          id?: string
          maps_url?: string | null
          name: string
        }
        Update: {
          address?: string | null
          area_hint?: string | null
          created_at?: string | null
          default_host_id?: string | null
          id?: string
          maps_url?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_default_host_id_fkey"
            columns: ["default_host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      gen_event_short_code: { Args: never; Returns: string }
      gen_resource_short_code: { Args: never; Returns: string }
      get_event_admin_secrets: {
        Args: { _event_id: string }
        Returns: {
          checkin_pin: string
          recording_passcode: string
          zoom_password: string
        }[]
      }
      get_event_attendee_profiles: {
        Args: { _event_id: string }
        Returns: {
          avatar_url: string
          family_name: string
          id: string
          name: string
        }[]
      }
      get_event_host_rsvps: {
        Args: { _event_id: string }
        Returns: {
          attending_dependents: Json
          checked_in: boolean
          created_at: string
          guests_count: number
          id: string
          is_waitlisted: boolean
          status: Database["public"]["Enums"]["rsvp_status"]
          user_id: string
        }[]
      }
      get_event_potluck_menu: {
        Args: { _event_id: string }
        Returns: {
          category: string
          dish: string
          order_index: number
          quantity: number
        }[]
      }
      get_event_rsvp_counts: {
        Args: { _event_id: string }
        Returns: {
          attending_count: number
          attending_rsvp_count: number
          checked_in_count: number
          waitlisted_count: number
        }[]
      }
      get_event_signup_claims: {
        Args: { _event_id: string }
        Returns: {
          sign_up_item_id: number
          total_quantity: number
        }[]
      }
      get_event_zoom_credentials: {
        Args: { _event_id: string }
        Returns: {
          recording_passcode: string
          zoom_password: string
        }[]
      }
      get_my_event_coverage: {
        Args: { _event_id: string }
        Returns: {
          attending_dependents: Json
          checked_in: boolean
          covering_user_name: string
          event_id: string
          guests_count: number
          id: string
          is_waitlisted: boolean
          potluck_category: Database["public"]["Enums"]["potluck_category"]
          qr_hash: string
          specific_food_item: string
          status: Database["public"]["Enums"]["rsvp_status"]
          user_id: string
        }[]
      }
      get_my_family_id: { Args: never; Returns: string }
      get_my_rsvp_qr: { Args: { _rsvp_id: string }; Returns: string }
      get_user_analytics_export: {
        Args: { date_from?: string; date_to?: string }
        Returns: {
          age: number
          avg_events_per_month: number
          checkin_rate: number
          days_since_checkin: number
          dependent_count: number
          email: string
          engagement_status: string
          family_name: string
          full_name: string
          gender: string
          guests_brought: number
          inperson_events_attended: number
          is_mureed: boolean
          last_checkin_date: string
          member_since: string
          no_shows: number
          phone: string
          total_checkins: number
          total_rsvps: number
          user_id: string
          virtual_events_attended: number
          whatsapp: string
        }[]
      }
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
      log_admin_change: {
        Args: {
          _action: string
          _details: Json
          _target_id: string
          _target_label: string
        }
        Returns: undefined
      }
      lookup_rsvp_by_qr: {
        Args: { _qr_hash: string }
        Returns: {
          attending_dependents: Json
          checked_in: boolean
          event_id: string
          guests_count: number
          id: string
          status: Database["public"]["Enums"]["rsvp_status"]
          user_id: string
        }[]
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
      next_unique_resource_short_code: {
        Args: { _desired: string; _self_id: string }
        Returns: string
      }
      next_unique_short_code: {
        Args: { _desired: string; _self_id: string }
        Returns: string
      }
      normalize_event_short_code: { Args: { _raw: string }; Returns: string }
      normalize_resource_short_code: { Args: { _raw: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      remove_self_from_family_rsvp: {
        Args: { _event_id: string }
        Returns: Json
      }
      verify_checkin_pin: {
        Args: { _event_id: string; _pin: string }
        Returns: boolean
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
      rsvp_status: "attending" | "waitlisted" | "cancelled"
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
      rsvp_status: ["attending", "waitlisted", "cancelled"],
    },
  },
} as const
