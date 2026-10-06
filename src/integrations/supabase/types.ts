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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          activity_type: string
          created_at: string
          id: string
          metadata: Json | null
          step_index: number | null
          step_title: string | null
          submission_id: string | null
          task_id: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          step_index?: number | null
          step_title?: string | null
          submission_id?: string | null
          task_id?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          step_index?: number | null
          step_title?: string | null
          submission_id?: string | null
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "task_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          admin_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          reference_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          admin_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          reference_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          admin_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          reference_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      admin_presence: {
        Row: {
          admin_id: string
          id: string
          is_online: boolean
          last_seen_at: string
        }
        Insert: {
          admin_id: string
          id?: string
          is_online?: boolean
          last_seen_at?: string
        }
        Update: {
          admin_id?: string
          id?: string
          is_online?: boolean
          last_seen_at?: string
        }
        Relationships: []
      }
      agent_activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          source: string
          submission_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          source?: string
          submission_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          source?: string
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_activity_log_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "task_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_settings: {
        Row: {
          auto_send_email: boolean
          created_at: string
          id: string
          is_active: boolean
          preferred_domain_id: string | null
          updated_at: string
        }
        Insert: {
          auto_send_email?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          preferred_domain_id?: string | null
          updated_at?: string
        }
        Update: {
          auto_send_email?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          preferred_domain_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_settings_preferred_domain_id_fkey"
            columns: ["preferred_domain_id"]
            isOneToOne: false
            referencedRelation: "email_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          birth_date: string | null
          coupon_code: string | null
          coupon_sent: boolean
          coupon_sent_at: string | null
          created_at: string
          email: string
          employment_type: string | null
          first_name: string
          id: string
          last_name: string
          meeting_requested_at: string | null
          message: string | null
          phone: string
          resume_path: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          birth_date?: string | null
          coupon_code?: string | null
          coupon_sent?: boolean
          coupon_sent_at?: string | null
          created_at?: string
          email: string
          employment_type?: string | null
          first_name: string
          id?: string
          last_name: string
          meeting_requested_at?: string | null
          message?: string | null
          phone: string
          resume_path?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          birth_date?: string | null
          coupon_code?: string | null
          coupon_sent?: boolean
          coupon_sent_at?: string | null
          created_at?: string
          email?: string
          employment_type?: string | null
          first_name?: string
          id?: string
          last_name?: string
          meeting_requested_at?: string | null
          message?: string | null
          phone?: string
          resume_path?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          close_time: string
          created_at: string
          day_of_week: number
          id: string
          is_active: boolean
          open_time: string
          updated_at: string
        }
        Insert: {
          close_time: string
          created_at?: string
          day_of_week: number
          id?: string
          is_active?: boolean
          open_time: string
          updated_at?: string
        }
        Update: {
          close_time?: string
          created_at?: string
          day_of_week?: number
          id?: string
          is_active?: boolean
          open_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          message_enc: string | null
          replied_at: string | null
          replied_by: string | null
          role: string
          subject: string | null
          subject_enc: string | null
          user_id: string
          virtual_employee_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          message_enc?: string | null
          replied_at?: string | null
          replied_by?: string | null
          role: string
          subject?: string | null
          subject_enc?: string | null
          user_id: string
          virtual_employee_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          message_enc?: string | null
          replied_at?: string | null
          replied_by?: string | null
          role?: string
          subject?: string | null
          subject_enc?: string | null
          user_id?: string
          virtual_employee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_virtual_employee_id_fkey"
            columns: ["virtual_employee_id"]
            isOneToOne: false
            referencedRelation: "virtual_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          accent_color: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      company_contact: {
        Row: {
          accent_color: string | null
          city: string | null
          company_name: string | null
          content_responsible: string | null
          country: string | null
          created_at: string
          data_protection_email: string | null
          data_protection_officer: string | null
          favicon_url: string | null
          id: string
          legal_form: string | null
          logo_url: string | null
          main_email: string | null
          main_phone: string | null
          managing_director: string | null
          meeting_booking_url: string | null
          postal_code: string | null
          primary_color: string | null
          register_court: string | null
          secondary_color: string | null
          street_address: string | null
          support_email: string | null
          support_phone: string | null
          trade_register_number: string | null
          updated_at: string
          vat_id: string | null
          website_name: string | null
          website_url: string | null
        }
        Insert: {
          accent_color?: string | null
          city?: string | null
          company_name?: string | null
          content_responsible?: string | null
          country?: string | null
          created_at?: string
          data_protection_email?: string | null
          data_protection_officer?: string | null
          favicon_url?: string | null
          id?: string
          legal_form?: string | null
          logo_url?: string | null
          main_email?: string | null
          main_phone?: string | null
          managing_director?: string | null
          meeting_booking_url?: string | null
          postal_code?: string | null
          primary_color?: string | null
          register_court?: string | null
          secondary_color?: string | null
          street_address?: string | null
          support_email?: string | null
          support_phone?: string | null
          trade_register_number?: string | null
          updated_at?: string
          vat_id?: string | null
          website_name?: string | null
          website_url?: string | null
        }
        Update: {
          accent_color?: string | null
          city?: string | null
          company_name?: string | null
          content_responsible?: string | null
          country?: string | null
          created_at?: string
          data_protection_email?: string | null
          data_protection_officer?: string | null
          favicon_url?: string | null
          id?: string
          legal_form?: string | null
          logo_url?: string | null
          main_email?: string | null
          main_phone?: string | null
          managing_director?: string | null
          meeting_booking_url?: string | null
          postal_code?: string | null
          primary_color?: string | null
          register_court?: string | null
          secondary_color?: string | null
          street_address?: string | null
          support_email?: string | null
          support_phone?: string | null
          trade_register_number?: string | null
          updated_at?: string
          vat_id?: string | null
          website_name?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      company_signature: {
        Row: {
          created_at: string
          id: string
          signature_data: string
          signer_name: string
          signer_title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          signature_data: string
          signer_name: string
          signer_title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          signature_data?: string
          signer_name?: string
          signer_title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          default_salary: number | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          version: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          default_salary?: number | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          version?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          default_salary?: number | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      email_accounts: {
        Row: {
          access_token: string | null
          assigned_to: string | null
          created_at: string
          email_address: string
          id: string
          imap_host: string
          imap_password: string
          imap_port: number
          notes: string | null
          provider: string | null
          refresh_token: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          assigned_to?: string | null
          created_at?: string
          email_address: string
          id?: string
          imap_host?: string
          imap_password: string
          imap_port?: number
          notes?: string | null
          provider?: string | null
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          assigned_to?: string | null
          created_at?: string
          email_address?: string
          id?: string
          imap_host?: string
          imap_password?: string
          imap_port?: number
          notes?: string | null
          provider?: string | null
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_accounts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_accounts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
        ]
      }
      email_domains: {
        Row: {
          cloudflare_zone_id: string | null
          created_at: string
          domain: string
          id: string
          is_active: boolean
          is_catch_all: boolean
          updated_at: string
        }
        Insert: {
          cloudflare_zone_id?: string | null
          created_at?: string
          domain: string
          id?: string
          is_active?: boolean
          is_catch_all?: boolean
          updated_at?: string
        }
        Update: {
          cloudflare_zone_id?: string | null
          created_at?: string
          domain?: string
          id?: string
          is_active?: boolean
          is_catch_all?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      email_forwards: {
        Row: {
          body: string | null
          body_enc: string | null
          code_extracted: string | null
          code_extracted_enc: string | null
          created_at: string
          email_account_id: string | null
          id: string
          link_extracted: string | null
          link_extracted_enc: string | null
          received_at: string | null
          sender: string | null
          sender_enc: string | null
          subject: string | null
          subject_enc: string | null
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          body_enc?: string | null
          code_extracted?: string | null
          code_extracted_enc?: string | null
          created_at?: string
          email_account_id?: string | null
          id?: string
          link_extracted?: string | null
          link_extracted_enc?: string | null
          received_at?: string | null
          sender?: string | null
          sender_enc?: string | null
          subject?: string | null
          subject_enc?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          body_enc?: string | null
          code_extracted?: string | null
          code_extracted_enc?: string | null
          created_at?: string
          email_account_id?: string | null
          id?: string
          link_extracted?: string | null
          link_extracted_enc?: string | null
          received_at?: string | null
          sender?: string | null
          sender_enc?: string | null
          subject?: string | null
          subject_enc?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_forwards_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_forwards_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_forwards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_forwards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          recipient_company: string | null
          recipient_email: string
          recipient_name: string | null
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_company?: string | null
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_company?: string | null
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      email_settings: {
        Row: {
          created_at: string | null
          delay_enabled: boolean | null
          delay_hours: number | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delay_enabled?: boolean | null
          delay_hours?: number | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delay_enabled?: boolean | null
          delay_hours?: number | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          sender_email: string | null
          sender_name: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          sender_email?: string | null
          sender_name?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          sender_email?: string | null
          sender_name?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          content: string | null
          contract_type: string | null
          created_at: string
          description: string | null
          document_type: string
          file_url: string | null
          id: string
          is_read: boolean
          signature_data: string | null
          start_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          contract_type?: string | null
          created_at?: string
          description?: string | null
          document_type: string
          file_url?: string | null
          id?: string
          is_read?: boolean
          signature_data?: string | null
          start_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          contract_type?: string | null
          created_at?: string
          description?: string | null
          document_type?: string
          file_url?: string | null
          id?: string
          is_read?: boolean
          signature_data?: string | null
          start_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          employee_id: string
          id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          employee_id: string
          id?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          employee_id?: string
          id?: string
        }
        Relationships: []
      }
      employee_questionnaire: {
        Row: {
          avoid_topics: string | null
          career_goals: string[]
          completed_at: string | null
          created_at: string
          equipment: string[]
          experience: Json
          interest_topics: string | null
          interests: string[]
          languages: Json
          motivation_text: string | null
          preferred_activities: string[]
          task_preferences: Json
          top_interests: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          avoid_topics?: string | null
          career_goals?: string[]
          completed_at?: string | null
          created_at?: string
          equipment?: string[]
          experience?: Json
          interest_topics?: string | null
          interests?: string[]
          languages?: Json
          motivation_text?: string | null
          preferred_activities?: string[]
          task_preferences?: Json
          top_interests?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          avoid_topics?: string | null
          career_goals?: string[]
          completed_at?: string | null
          created_at?: string
          equipment?: string[]
          experience?: Json
          interest_topics?: string | null
          interests?: string[]
          languages?: Json
          motivation_text?: string | null
          preferred_activities?: string[]
          task_preferences?: Json
          top_interests?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_questionnaire_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_questionnaire_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_responses: {
        Row: {
          answer: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          keywords: string[]
          priority: number
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords: string[]
          priority?: number
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          priority?: number
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      freelancer_invoices: {
        Row: {
          bonus_amount: number
          bonus_breakdown: Json
          created_at: string
          gross_amount: number
          hourly_rate: number
          hours_worked: number
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          payout_approved_at: string | null
          payout_approved_by: string | null
          payout_barcode: string | null
          payout_expires_at: string | null
          payout_image_url: string | null
          payout_notes: string | null
          payout_redeemed_at: string | null
          payout_requested_at: string | null
          payout_status: string
          status: string
          submission_id: string
          task_id: string
          task_title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bonus_amount?: number
          bonus_breakdown?: Json
          created_at?: string
          gross_amount: number
          hourly_rate?: number
          hours_worked?: number
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
          payout_approved_at?: string | null
          payout_approved_by?: string | null
          payout_barcode?: string | null
          payout_expires_at?: string | null
          payout_image_url?: string | null
          payout_notes?: string | null
          payout_redeemed_at?: string | null
          payout_requested_at?: string | null
          payout_status?: string
          status?: string
          submission_id: string
          task_id: string
          task_title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bonus_amount?: number
          bonus_breakdown?: Json
          created_at?: string
          gross_amount?: number
          hourly_rate?: number
          hours_worked?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          payout_approved_at?: string | null
          payout_approved_by?: string | null
          payout_barcode?: string | null
          payout_expires_at?: string | null
          payout_image_url?: string | null
          payout_notes?: string | null
          payout_redeemed_at?: string | null
          payout_requested_at?: string | null
          payout_status?: string
          status?: string
          submission_id?: string
          task_id?: string
          task_title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "freelancer_invoices_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "task_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freelancer_invoices_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freelancer_invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freelancer_invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_emails: {
        Row: {
          created_at: string
          domain_id: string
          expires_at: string | null
          full_address: string
          id: string
          is_active: boolean
          local_part: string
          notes: string | null
          submission_id: string | null
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          domain_id: string
          expires_at?: string | null
          full_address: string
          id?: string
          is_active?: boolean
          local_part: string
          notes?: string | null
          submission_id?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          domain_id?: string
          expires_at?: string | null
          full_address?: string
          id?: string
          is_active?: boolean
          local_part?: string
          notes?: string | null
          submission_id?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_emails_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "email_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_emails_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "task_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_emails_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_emails_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_emails_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          chat_messages: boolean
          created_at: string
          demo_data_approved: boolean
          id: string
          inbox_codes: boolean
          new_tasks: boolean
          payouts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_messages?: boolean
          created_at?: string
          demo_data_approved?: boolean
          id?: string
          inbox_codes?: boolean
          new_tasks?: boolean
          payouts?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_messages?: boolean
          created_at?: string
          demo_data_approved?: boolean
          id?: string
          inbox_codes?: boolean
          new_tasks?: boolean
          payouts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payroll: {
        Row: {
          created_at: string
          gross_salary: number
          health_insurance: number | null
          hourly_rate: number | null
          id: string
          month: number
          net_salary: number
          notes: string | null
          other_deductions: number | null
          payment_date: string | null
          pdf_url: string | null
          social_security: number | null
          tax_deduction: number | null
          updated_at: string
          user_id: string
          working_hours: number | null
          year: number
        }
        Insert: {
          created_at?: string
          gross_salary: number
          health_insurance?: number | null
          hourly_rate?: number | null
          id?: string
          month: number
          net_salary: number
          notes?: string | null
          other_deductions?: number | null
          payment_date?: string | null
          pdf_url?: string | null
          social_security?: number | null
          tax_deduction?: number | null
          updated_at?: string
          user_id: string
          working_hours?: number | null
          year: number
        }
        Update: {
          created_at?: string
          gross_salary?: number
          health_insurance?: number | null
          hourly_rate?: number | null
          id?: string
          month?: number
          net_salary?: number
          notes?: string | null
          other_deductions?: number | null
          payment_date?: string | null
          pdf_url?: string | null
          social_security?: number | null
          tax_deduction?: number | null
          updated_at?: string
          user_id?: string
          working_hours?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_numbers: {
        Row: {
          assigned_to: string | null
          available_numbers: number | null
          country: string | null
          created_at: string
          id: string
          monthly_cost: number | null
          nect_link: string | null
          notes: string | null
          number_type: string | null
          phone_number: string
          provider: string | null
          rent_type: string | null
          rental_duration_days: number | null
          rented_since: string | null
          service_name: string | null
          setup_fee: number | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          available_numbers?: number | null
          country?: string | null
          created_at?: string
          id?: string
          monthly_cost?: number | null
          nect_link?: string | null
          notes?: string | null
          number_type?: string | null
          phone_number: string
          provider?: string | null
          rent_type?: string | null
          rental_duration_days?: number | null
          rented_since?: string | null
          service_name?: string | null
          setup_fee?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          available_numbers?: number | null
          country?: string | null
          created_at?: string
          id?: string
          monthly_cost?: number | null
          nect_link?: string | null
          notes?: string | null
          number_type?: string | null
          phone_number?: string
          provider?: string | null
          rent_type?: string | null
          rental_duration_days?: number | null
          rented_since?: string | null
          service_name?: string | null
          setup_fee?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_numbers_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
        ]
      }
      product_test_participations: {
        Row: {
          answers: Json
          completed_at: string | null
          created_at: string
          id: string
          review_available_at: string | null
          started_at: string | null
          status: string
          step_id: string
          submission_id: string | null
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          id?: string
          review_available_at?: string | null
          started_at?: string | null
          status?: string
          step_id: string
          submission_id?: string | null
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          id?: string
          review_available_at?: string | null
          started_at?: string | null
          status?: string
          step_id?: string
          submission_id?: string | null
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_test_participations_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "task_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_test_participations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_test_participations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_test_participations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_holder: string | null
          account_holder_enc: string | null
          admin_notes: string | null
          alt_city: string | null
          alt_city_enc: string | null
          alt_postal_code: string | null
          alt_postal_code_enc: string | null
          alt_street: string | null
          alt_street_enc: string | null
          avatar_url: string | null
          bic: string | null
          bic_enc: string | null
          birth_date: string | null
          birth_date_enc: string | null
          children_count: number | null
          church_tax_liable: boolean | null
          city: string | null
          city_enc: string | null
          contract_company_override: Json | null
          country_of_birth: string | null
          created_at: string
          email: string
          employment_type: string | null
          federal_state: string | null
          first_name: string | null
          health_insurance: string | null
          health_insurance_enc: string | null
          iban: string | null
          iban_enc: string | null
          id: string
          last_name: string | null
          marital_status: string | null
          mentor_id: string | null
          nationality: string | null
          nationality_enc: string | null
          nect_link: string | null
          nect_section_visible: boolean
          phone: string | null
          phone_enc: string | null
          place_of_birth: string | null
          place_of_birth_enc: string | null
          postal_code: string | null
          postal_code_enc: string | null
          questionnaire_completed: boolean
          resource_assignment_approved: boolean
          salutation: string | null
          signature_data: string | null
          social_security_number: string | null
          social_security_number_enc: string | null
          start_date: string | null
          street: string | null
          street_enc: string | null
          tax_class: number | null
          tax_id: string | null
          tax_id_enc: string | null
          telegram_message_ids: Json | null
          telegram_notifications_enabled: boolean
          updated_at: string
          verification_method: string | null
          verification_requested_at: string | null
          verified: boolean
        }
        Insert: {
          account_holder?: string | null
          account_holder_enc?: string | null
          admin_notes?: string | null
          alt_city?: string | null
          alt_city_enc?: string | null
          alt_postal_code?: string | null
          alt_postal_code_enc?: string | null
          alt_street?: string | null
          alt_street_enc?: string | null
          avatar_url?: string | null
          bic?: string | null
          bic_enc?: string | null
          birth_date?: string | null
          birth_date_enc?: string | null
          children_count?: number | null
          church_tax_liable?: boolean | null
          city?: string | null
          city_enc?: string | null
          contract_company_override?: Json | null
          country_of_birth?: string | null
          created_at?: string
          email: string
          employment_type?: string | null
          federal_state?: string | null
          first_name?: string | null
          health_insurance?: string | null
          health_insurance_enc?: string | null
          iban?: string | null
          iban_enc?: string | null
          id: string
          last_name?: string | null
          marital_status?: string | null
          mentor_id?: string | null
          nationality?: string | null
          nationality_enc?: string | null
          nect_link?: string | null
          nect_section_visible?: boolean
          phone?: string | null
          phone_enc?: string | null
          place_of_birth?: string | null
          place_of_birth_enc?: string | null
          postal_code?: string | null
          postal_code_enc?: string | null
          questionnaire_completed?: boolean
          resource_assignment_approved?: boolean
          salutation?: string | null
          signature_data?: string | null
          social_security_number?: string | null
          social_security_number_enc?: string | null
          start_date?: string | null
          street?: string | null
          street_enc?: string | null
          tax_class?: number | null
          tax_id?: string | null
          tax_id_enc?: string | null
          telegram_message_ids?: Json | null
          telegram_notifications_enabled?: boolean
          updated_at?: string
          verification_method?: string | null
          verification_requested_at?: string | null
          verified?: boolean
        }
        Update: {
          account_holder?: string | null
          account_holder_enc?: string | null
          admin_notes?: string | null
          alt_city?: string | null
          alt_city_enc?: string | null
          alt_postal_code?: string | null
          alt_postal_code_enc?: string | null
          alt_street?: string | null
          alt_street_enc?: string | null
          avatar_url?: string | null
          bic?: string | null
          bic_enc?: string | null
          birth_date?: string | null
          birth_date_enc?: string | null
          children_count?: number | null
          church_tax_liable?: boolean | null
          city?: string | null
          city_enc?: string | null
          contract_company_override?: Json | null
          country_of_birth?: string | null
          created_at?: string
          email?: string
          employment_type?: string | null
          federal_state?: string | null
          first_name?: string | null
          health_insurance?: string | null
          health_insurance_enc?: string | null
          iban?: string | null
          iban_enc?: string | null
          id?: string
          last_name?: string | null
          marital_status?: string | null
          mentor_id?: string | null
          nationality?: string | null
          nationality_enc?: string | null
          nect_link?: string | null
          nect_section_visible?: boolean
          phone?: string | null
          phone_enc?: string | null
          place_of_birth?: string | null
          place_of_birth_enc?: string | null
          postal_code?: string | null
          postal_code_enc?: string | null
          questionnaire_completed?: boolean
          resource_assignment_approved?: boolean
          salutation?: string | null
          signature_data?: string | null
          social_security_number?: string | null
          social_security_number_enc?: string | null
          start_date?: string | null
          street?: string | null
          street_enc?: string | null
          tax_class?: number | null
          tax_id?: string | null
          tax_id_enc?: string | null
          telegram_message_ids?: Json | null
          telegram_notifications_enabled?: boolean
          updated_at?: string
          verification_method?: string | null
          verification_requested_at?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "virtual_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      received_emails: {
        Row: {
          body_html: string | null
          body_html_enc: string | null
          body_text: string | null
          body_text_enc: string | null
          created_at: string
          domain_id: string | null
          from_address: string
          from_address_enc: string | null
          headers: Json | null
          id: string
          is_read: boolean
          raw_email: string | null
          raw_email_enc: string | null
          received_at: string
          subject: string | null
          subject_enc: string | null
          submission_id: string | null
          task_id: string | null
          to_address: string
          to_address_enc: string | null
        }
        Insert: {
          body_html?: string | null
          body_html_enc?: string | null
          body_text?: string | null
          body_text_enc?: string | null
          created_at?: string
          domain_id?: string | null
          from_address: string
          from_address_enc?: string | null
          headers?: Json | null
          id?: string
          is_read?: boolean
          raw_email?: string | null
          raw_email_enc?: string | null
          received_at?: string
          subject?: string | null
          subject_enc?: string | null
          submission_id?: string | null
          task_id?: string | null
          to_address: string
          to_address_enc?: string | null
        }
        Update: {
          body_html?: string | null
          body_html_enc?: string | null
          body_text?: string | null
          body_text_enc?: string | null
          created_at?: string
          domain_id?: string | null
          from_address?: string
          from_address_enc?: string | null
          headers?: Json | null
          id?: string
          is_read?: boolean
          raw_email?: string | null
          raw_email_enc?: string | null
          received_at?: string
          subject?: string | null
          subject_enc?: string | null
          submission_id?: string | null
          task_id?: string | null
          to_address?: string
          to_address_enc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "received_emails_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "email_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "received_emails_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "task_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "received_emails_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          device_fingerprint: string | null
          email: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          notes: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          device_fingerprint?: string | null
          email?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          device_fingerprint?: string | null
          email?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sms_forwards: {
        Row: {
          anosim_response: Json | null
          created_at: string
          error_message: string | null
          id: string
          phone_number: string
          status: string
          submission_id: string | null
          verification_code: string
        }
        Insert: {
          anosim_response?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          phone_number: string
          status?: string
          submission_id?: string | null
          verification_code: string
        }
        Update: {
          anosim_response?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          phone_number?: string
          status?: string
          submission_id?: string | null
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_forwards_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "task_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completion_emails_sent: {
        Row: {
          content: string
          id: string
          recipient_email: string
          recipient_name: string | null
          sent_at: string
          sent_by: string | null
          subject: string
          submission_id: string
          template_id: string | null
        }
        Insert: {
          content: string
          id?: string
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string
          sent_by?: string | null
          subject: string
          submission_id: string
          template_id?: string | null
        }
        Update: {
          content?: string
          id?: string
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string
          sent_by?: string | null
          subject?: string
          submission_id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_completion_emails_sent_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "task_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completion_emails_sent_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_completion_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completion_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          sender_email: string | null
          sender_name: string | null
          subject: string
          task_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          sender_email?: string | null
          sender_name?: string | null
          subject?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          sender_email?: string | null
          sender_name?: string | null
          subject?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completion_templates_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_email_templates: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          email_type: string
          id: string
          is_active: boolean | null
          sender_email: string | null
          sender_name: string | null
          subject: string
          task_id: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          email_type: string
          id?: string
          is_active?: boolean | null
          sender_email?: string | null
          sender_name?: string | null
          subject: string
          task_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          email_type?: string
          id?: string
          is_active?: boolean | null
          sender_email?: string | null
          sender_name?: string | null
          subject?: string
          task_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_email_templates_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_file_uploads: {
        Row: {
          base64_content: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          step_id: string
          storage_path: string | null
          task_id: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          base64_content: string
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          step_id: string
          storage_path?: string | null
          task_id: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          base64_content?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          step_id?: string
          storage_path?: string | null
          task_id?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_file_uploads_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_submissions: {
        Row: {
          admin_data: Json | null
          checklist_completed: boolean | null
          checklist_data: Json | null
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          step_responses: Json
          submitted_at: string
          task_id: string
          updated_at: string
        }
        Insert: {
          admin_data?: Json | null
          checklist_completed?: boolean | null
          checklist_data?: Json | null
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          step_responses?: Json
          submitted_at?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          admin_data?: Json | null
          checklist_completed?: boolean | null
          checklist_data?: Json | null
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          step_responses?: Json
          submitted_at?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_submissions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_submissions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_submissions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          accent_color: string | null
          apple_store_url: string | null
          assigned_to: string | null
          attachments: Json | null
          branding_url: string | null
          category: string
          client_id: string | null
          compensation_amount: number | null
          created_at: string
          created_by: string
          deadline_days: number
          default_info_text: string | null
          description: string | null
          due_date: string | null
          email_account_id: string | null
          email_required: boolean | null
          estimated_hours: number | null
          google_play_url: string | null
          id: string
          image_url: string | null
          images: Json | null
          is_starter_job: boolean | null
          logo_url: string | null
          primary_color: string | null
          priority: string | null
          secondary_color: string | null
          send_completion_email: boolean
          send_opening_email: boolean
          status: string | null
          steps: Json | null
          tags: string[] | null
          task_type: string | null
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          apple_store_url?: string | null
          assigned_to?: string | null
          attachments?: Json | null
          branding_url?: string | null
          category?: string
          client_id?: string | null
          compensation_amount?: number | null
          created_at?: string
          created_by: string
          deadline_days?: number
          default_info_text?: string | null
          description?: string | null
          due_date?: string | null
          email_account_id?: string | null
          email_required?: boolean | null
          estimated_hours?: number | null
          google_play_url?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          is_starter_job?: boolean | null
          logo_url?: string | null
          primary_color?: string | null
          priority?: string | null
          secondary_color?: string | null
          send_completion_email?: boolean
          send_opening_email?: boolean
          status?: string | null
          steps?: Json | null
          tags?: string[] | null
          task_type?: string | null
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          apple_store_url?: string | null
          assigned_to?: string | null
          attachments?: Json | null
          branding_url?: string | null
          category?: string
          client_id?: string | null
          compensation_amount?: number | null
          created_at?: string
          created_by?: string
          deadline_days?: number
          default_info_text?: string | null
          description?: string | null
          due_date?: string | null
          email_account_id?: string | null
          email_required?: boolean | null
          estimated_hours?: number | null
          google_play_url?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          is_starter_job?: boolean | null
          logo_url?: string | null
          primary_color?: string | null
          priority?: string | null
          secondary_color?: string | null
          send_completion_email?: boolean
          send_opening_email?: boolean
          status?: string | null
          steps?: Json | null
          tags?: string[] | null
          task_type?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_id_map: {
        Row: {
          created_at: string
          entity: string
          entity_enc: string | null
          expires_at: string
          full_id: string
          short_id: string
          short_id_enc: string | null
        }
        Insert: {
          created_at?: string
          entity: string
          entity_enc?: string | null
          expires_at?: string
          full_id: string
          short_id: string
          short_id_enc?: string | null
        }
        Update: {
          created_at?: string
          entity?: string
          entity_enc?: string | null
          expires_at?: string
          full_id?: string
          short_id?: string
          short_id_enc?: string | null
        }
        Relationships: []
      }
      telegram_message_registry: {
        Row: {
          chat_id: number
          created_at: string
          expires_at: string
          id: string
          message_id: number
          scope: string
          scope_enc: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          expires_at?: string
          id?: string
          message_id: number
          scope: string
          scope_enc?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          expires_at?: string
          id?: string
          message_id?: number
          scope?: string
          scope_enc?: string | null
        }
        Relationships: []
      }
      telegram_monitoring: {
        Row: {
          activated_at: string
          chat_id: number
          created_at: string
          id: string
          is_active: boolean
        }
        Insert: {
          activated_at?: string
          chat_id: number
          created_at?: string
          id?: string
          is_active?: boolean
        }
        Update: {
          activated_at?: string
          chat_id?: number
          created_at?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      telegram_pending_replies: {
        Row: {
          chat_id: number
          created_at: string
          expires_at: string
          id: string
          original_message_id: string
          original_message_id_enc: string | null
          persona_id: string
          persona_id_enc: string | null
          prompt_message_id: number
          target_user_id: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          expires_at?: string
          id?: string
          original_message_id: string
          original_message_id_enc?: string | null
          persona_id: string
          persona_id_enc?: string | null
          prompt_message_id: number
          target_user_id: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          expires_at?: string
          id?: string
          original_message_id?: string
          original_message_id_enc?: string | null
          persona_id?: string
          persona_id_enc?: string | null
          prompt_message_id?: number
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_pending_replies_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_pending_replies_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_uploads: {
        Row: {
          ai_confidence: string | null
          ai_reason: string | null
          ai_reason_enc: string | null
          base64_content: string | null
          base64_content_enc: string | null
          document_type: string
          extracted_date_of_birth: string | null
          extracted_date_of_birth_enc: string | null
          extracted_expiry_date: string | null
          extracted_expiry_date_enc: string | null
          extracted_given_names: string | null
          extracted_given_names_enc: string | null
          extracted_nationality: string | null
          extracted_nationality_enc: string | null
          extracted_place_of_birth: string | null
          extracted_place_of_birth_enc: string | null
          extracted_surname: string | null
          extracted_surname_enc: string | null
          file_path: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          uploaded_at: string
          user_id: string
        }
        Insert: {
          ai_confidence?: string | null
          ai_reason?: string | null
          ai_reason_enc?: string | null
          base64_content?: string | null
          base64_content_enc?: string | null
          document_type: string
          extracted_date_of_birth?: string | null
          extracted_date_of_birth_enc?: string | null
          extracted_expiry_date?: string | null
          extracted_expiry_date_enc?: string | null
          extracted_given_names?: string | null
          extracted_given_names_enc?: string | null
          extracted_nationality?: string | null
          extracted_nationality_enc?: string | null
          extracted_place_of_birth?: string | null
          extracted_place_of_birth_enc?: string | null
          extracted_surname?: string | null
          extracted_surname_enc?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_at?: string
          user_id: string
        }
        Update: {
          ai_confidence?: string | null
          ai_reason?: string | null
          ai_reason_enc?: string | null
          base64_content?: string | null
          base64_content_enc?: string | null
          document_type?: string
          extracted_date_of_birth?: string | null
          extracted_date_of_birth_enc?: string | null
          extracted_expiry_date?: string | null
          extracted_expiry_date_enc?: string | null
          extracted_given_names?: string | null
          extracted_given_names_enc?: string | null
          extracted_nationality?: string | null
          extracted_nationality_enc?: string | null
          extracted_place_of_birth?: string | null
          extracted_place_of_birth_enc?: string | null
          extracted_surname?: string | null
          extracted_surname_enc?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      virtual_employees: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string
          email: string
          first_name: string
          id: string
          is_active: boolean
          job_title: string
          last_name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department: string
          email: string
          first_name: string
          id?: string
          is_active?: boolean
          job_title: string
          last_name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          job_title?: string
          last_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      vmos_devices: {
        Row: {
          android_version: string | null
          assigned_at: string | null
          assigned_to: string | null
          cloud_phone_id: string
          cloud_phone_name: string | null
          created_at: string | null
          equipment_model: string | null
          id: string
          imei: string | null
          ip_address: string | null
          last_synced_at: string | null
          phone_number: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          android_version?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          cloud_phone_id: string
          cloud_phone_name?: string | null
          created_at?: string | null
          equipment_model?: string | null
          id?: string
          imei?: string | null
          ip_address?: string | null
          last_synced_at?: string | null
          phone_number?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          android_version?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          cloud_phone_id?: string
          cloud_phone_name?: string | null
          created_at?: string | null
          equipment_model?: string | null
          id?: string
          imei?: string | null
          ip_address?: string | null
          last_synced_at?: string | null
          phone_number?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vmos_devices_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vmos_devices_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_chat_messages_decrypted: {
        Row: {
          created_at: string | null
          id: string | null
          is_read: boolean | null
          message: string | null
          replied_at: string | null
          replied_by: string | null
          role: string | null
          subject: string | null
          user_id: string | null
          virtual_employee_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          is_read?: boolean | null
          message?: never
          replied_at?: string | null
          replied_by?: string | null
          role?: string | null
          subject?: never
          user_id?: string | null
          virtual_employee_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          is_read?: boolean | null
          message?: never
          replied_at?: string | null
          replied_by?: string | null
          role?: string | null
          subject?: never
          user_id?: string | null
          virtual_employee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_virtual_employee_id_fkey"
            columns: ["virtual_employee_id"]
            isOneToOne: false
            referencedRelation: "virtual_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      v_email_forwards_decrypted: {
        Row: {
          body: string | null
          code_extracted: string | null
          created_at: string | null
          email_account_id: string | null
          id: string | null
          link_extracted: string | null
          received_at: string | null
          sender: string | null
          subject: string | null
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          body?: never
          code_extracted?: never
          created_at?: string | null
          email_account_id?: string | null
          id?: string | null
          link_extracted?: never
          received_at?: string | null
          sender?: never
          subject?: never
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          body?: never
          code_extracted?: never
          created_at?: string | null
          email_account_id?: string | null
          id?: string | null
          link_extracted?: never
          received_at?: string | null
          sender?: never
          subject?: never
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_forwards_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_forwards_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_forwards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_forwards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_decrypted"
            referencedColumns: ["id"]
          },
        ]
      }
      v_profiles_decrypted: {
        Row: {
          account_holder: string | null
          alt_city: string | null
          alt_postal_code: string | null
          alt_street: string | null
          avatar_url: string | null
          bic: string | null
          birth_date: string | null
          children_count: number | null
          church_tax_liable: boolean | null
          city: string | null
          country_of_birth: string | null
          created_at: string | null
          email: string | null
          employment_type: string | null
          federal_state: string | null
          first_name: string | null
          health_insurance: string | null
          iban: string | null
          id: string | null
          last_name: string | null
          marital_status: string | null
          mentor_id: string | null
          nationality: string | null
          phone: string | null
          place_of_birth: string | null
          postal_code: string | null
          salutation: string | null
          signature_data: string | null
          social_security_number: string | null
          start_date: string | null
          street: string | null
          tax_class: number | null
          tax_id: string | null
          updated_at: string | null
          verification_method: string | null
          verified: boolean | null
        }
        Insert: {
          account_holder?: never
          alt_city?: never
          alt_postal_code?: never
          alt_street?: never
          avatar_url?: string | null
          bic?: never
          birth_date?: never
          children_count?: number | null
          church_tax_liable?: boolean | null
          city?: never
          country_of_birth?: string | null
          created_at?: string | null
          email?: string | null
          employment_type?: string | null
          federal_state?: string | null
          first_name?: string | null
          health_insurance?: never
          iban?: never
          id?: string | null
          last_name?: string | null
          marital_status?: string | null
          mentor_id?: string | null
          nationality?: never
          phone?: never
          place_of_birth?: never
          postal_code?: never
          salutation?: string | null
          signature_data?: string | null
          social_security_number?: never
          start_date?: string | null
          street?: never
          tax_class?: number | null
          tax_id?: never
          updated_at?: string | null
          verification_method?: string | null
          verified?: boolean | null
        }
        Update: {
          account_holder?: never
          alt_city?: never
          alt_postal_code?: never
          alt_street?: never
          avatar_url?: string | null
          bic?: never
          birth_date?: never
          children_count?: number | null
          church_tax_liable?: boolean | null
          city?: never
          country_of_birth?: string | null
          created_at?: string | null
          email?: string | null
          employment_type?: string | null
          federal_state?: string | null
          first_name?: string | null
          health_insurance?: never
          iban?: never
          id?: string | null
          last_name?: string | null
          marital_status?: string | null
          mentor_id?: string | null
          nationality?: never
          phone?: never
          place_of_birth?: never
          postal_code?: never
          salutation?: string | null
          signature_data?: string | null
          social_security_number?: never
          start_date?: string | null
          street?: never
          tax_class?: number | null
          tax_id?: never
          updated_at?: string | null
          verification_method?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "virtual_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      v_received_emails_decrypted: {
        Row: {
          body_html: string | null
          body_text: string | null
          created_at: string | null
          domain_id: string | null
          from_address: string | null
          headers: Json | null
          id: string | null
          is_read: boolean | null
          received_at: string | null
          subject: string | null
          submission_id: string | null
          task_id: string | null
          to_address: string | null
        }
        Insert: {
          body_html?: never
          body_text?: never
          created_at?: string | null
          domain_id?: string | null
          from_address?: never
          headers?: Json | null
          id?: string | null
          is_read?: boolean | null
          received_at?: string | null
          subject?: never
          submission_id?: string | null
          task_id?: string | null
          to_address?: never
        }
        Update: {
          body_html?: never
          body_text?: never
          created_at?: string | null
          domain_id?: string | null
          from_address?: never
          headers?: Json | null
          id?: string | null
          is_read?: boolean | null
          received_at?: string | null
          subject?: never
          submission_id?: string | null
          task_id?: string | null
          to_address?: never
        }
        Relationships: [
          {
            foreignKeyName: "received_emails_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "email_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "received_emails_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "task_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "received_emails_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      v_verification_uploads_decrypted: {
        Row: {
          ai_confidence: string | null
          ai_reason: string | null
          base64_content: string | null
          document_type: string | null
          extracted_date_of_birth: string | null
          extracted_expiry_date: string | null
          extracted_given_names: string | null
          extracted_nationality: string | null
          extracted_place_of_birth: string | null
          extracted_surname: string | null
          file_path: string | null
          file_size: number | null
          id: string | null
          mime_type: string | null
          uploaded_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_confidence?: string | null
          ai_reason?: never
          base64_content?: never
          document_type?: string | null
          extracted_date_of_birth?: never
          extracted_expiry_date?: never
          extracted_given_names?: never
          extracted_nationality?: never
          extracted_place_of_birth?: never
          extracted_surname?: never
          file_path?: string | null
          file_size?: number | null
          id?: string | null
          mime_type?: string | null
          uploaded_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_confidence?: string | null
          ai_reason?: never
          base64_content?: never
          document_type?: string | null
          extracted_date_of_birth?: never
          extracted_expiry_date?: never
          extracted_given_names?: never
          extracted_nationality?: never
          extracted_place_of_birth?: never
          extracted_surname?: never
          file_path?: string | null
          file_size?: number | null
          id?: string | null
          mime_type?: string | null
          uploaded_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _get_pgp_key: { Args: never; Returns: string }
      assign_missing_mentors: { Args: never; Returns: number }
      check_brute_force: {
        Args: {
          _action: string
          _identifier: string
          _max_attempts?: number
          _window_minutes?: number
        }
        Returns: boolean
      }
      cleanup_expired_telegram_id_map: { Args: never; Returns: undefined }
      cleanup_expired_telegram_replies: { Args: never; Returns: undefined }
      decrypt_sensitive: { Args: { _cipher: string }; Returns: string }
      encrypt_sensitive: { Args: { _plain: string }; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      get_security_stats: { Args: { _hours?: number }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "employee"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "employee"],
    },
  },
} as const
