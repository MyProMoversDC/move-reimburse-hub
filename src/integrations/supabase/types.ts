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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      address_history: {
        Row: {
          address: string
          changed_at: string
          id: string
          user_id: string
        }
        Insert: {
          address: string
          changed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          address?: string
          changed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      alcohol_test_reports: {
        Row: {
          actions_taken: string[]
          additional_notes: string | null
          bac_reading_first: number
          bac_reading_second: number | null
          created_at: string
          final_result: string
          id: string
          photo_file_name: string
          photo_url: string
          reviewed_at: string | null
          second_test_required: boolean
          sop_acknowledged: boolean
          test_date: string
          test_location: string
          test_time: string
          test_timing: string
          test_type: string
          test_type_other_explanation: string | null
          tester_confirmed_administered: boolean
          tester_id: string
          tester_job_title: string
          tester_name: string
          waiting_period_observed: boolean
          worker_classification: string
          worker_confirmed_no_consumption: boolean
          worker_id: string
          worker_name: string
          worker_role: string
        }
        Insert: {
          actions_taken: string[]
          additional_notes?: string | null
          bac_reading_first: number
          bac_reading_second?: number | null
          created_at?: string
          final_result: string
          id?: string
          photo_file_name: string
          photo_url: string
          reviewed_at?: string | null
          second_test_required?: boolean
          sop_acknowledged?: boolean
          test_date: string
          test_location: string
          test_time: string
          test_timing: string
          test_type: string
          test_type_other_explanation?: string | null
          tester_confirmed_administered?: boolean
          tester_id: string
          tester_job_title: string
          tester_name: string
          waiting_period_observed?: boolean
          worker_classification: string
          worker_confirmed_no_consumption?: boolean
          worker_id: string
          worker_name: string
          worker_role: string
        }
        Update: {
          actions_taken?: string[]
          additional_notes?: string | null
          bac_reading_first?: number
          bac_reading_second?: number | null
          created_at?: string
          final_result?: string
          id?: string
          photo_file_name?: string
          photo_url?: string
          reviewed_at?: string | null
          second_test_required?: boolean
          sop_acknowledged?: boolean
          test_date?: string
          test_location?: string
          test_time?: string
          test_timing?: string
          test_type?: string
          test_type_other_explanation?: string | null
          tester_confirmed_administered?: boolean
          tester_id?: string
          tester_job_title?: string
          tester_name?: string
          waiting_period_observed?: boolean
          worker_classification?: string
          worker_confirmed_no_consumption?: boolean
          worker_id?: string
          worker_name?: string
          worker_role?: string
        }
        Relationships: []
      }
      annual_address_confirmations: {
        Row: {
          address_changed: boolean
          address_confirmed: string
          confirmed_at: string
          confirmed_year: number
          id: string
          user_id: string
        }
        Insert: {
          address_changed?: boolean
          address_confirmed: string
          confirmed_at?: string
          confirmed_year: number
          id?: string
          user_id: string
        }
        Update: {
          address_changed?: boolean
          address_confirmed?: string
          confirmed_at?: string
          confirmed_year?: number
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_message_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          message_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_acknowledgments: {
        Row: {
          acknowledged_at: string
          consent_document_id: string
          id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          consent_document_id: string
          id?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          consent_document_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_acknowledgments_consent_document_id_fkey"
            columns: ["consent_document_id"]
            isOneToOne: false
            referencedRelation: "consent_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_documents: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          is_active: boolean
          uploaded_by: string
          version: number
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type: string
          file_url: string
          id?: string
          is_active?: boolean
          uploaded_by: string
          version?: number
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          is_active?: boolean
          uploaded_by?: string
          version?: number
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_group: boolean
          name: string | null
          topic_reference_id: string | null
          topic_reference_label: string | null
          topic_type: Database["public"]["Enums"]["chat_topic_type"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_group?: boolean
          name?: string | null
          topic_reference_id?: string | null
          topic_reference_label?: string | null
          topic_type?: Database["public"]["Enums"]["chat_topic_type"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_group?: boolean
          name?: string | null
          topic_reference_id?: string | null
          topic_reference_label?: string | null
          topic_type?: Database["public"]["Enums"]["chat_topic_type"] | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_refunds: {
        Row: {
          amount: number
          comments: string | null
          created_at: string
          customer_name: string
          id: string
          payment_method: string
          payment_method_other: string | null
          reimbursement_reason: string
          request_date: string
          submitted_by: string
        }
        Insert: {
          amount: number
          comments?: string | null
          created_at?: string
          customer_name: string
          id?: string
          payment_method: string
          payment_method_other?: string | null
          reimbursement_reason: string
          request_date: string
          submitted_by: string
        }
        Update: {
          amount?: number
          comments?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          payment_method?: string
          payment_method_other?: string | null
          reimbursement_reason?: string
          request_date?: string
          submitted_by?: string
        }
        Relationships: []
      }
      deductibles: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          mover_id: string
          mover_name: string
          reason: string | null
          report_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          mover_id: string
          mover_name: string
          reason?: string | null
          report_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          mover_id?: string
          mover_name?: string
          reason?: string | null
          report_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deductibles_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "performance_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_document_reviews: {
        Row: {
          created_at: string
          decline_reason: string | null
          document_type: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decline_reason?: string | null
          document_type: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decline_reason?: string | null
          document_type?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          body_html: string | null
          body_text: string | null
          created_at: string
          email_type: string
          error_message: string | null
          from_email: string
          id: string
          reference_id: string | null
          reference_type: string | null
          resend_id: string | null
          status: string
          subject: string
          to_emails: string[]
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          email_type: string
          error_message?: string | null
          from_email: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          resend_id?: string | null
          status?: string
          subject: string
          to_emails: string[]
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          email_type?: string
          error_message?: string | null
          from_email?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          resend_id?: string | null
          status?: string
          subject?: string
          to_emails?: string[]
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string | null
          phone: string | null
          phone_type: string | null
          relationship: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string | null
          phone?: string | null
          phone_type?: string | null
          relationship?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string | null
          phone?: string | null
          phone_type?: string | null
          relationship?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feed_post_acknowledgments: {
        Row: {
          acknowledged_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_acknowledgments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          post_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          post_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_attachments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_poll_options: {
        Row: {
          created_at: string
          id: string
          option_text: string
          poll_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          option_text: string
          poll_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          option_text?: string
          poll_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "feed_post_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_poll_votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "feed_post_poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_post_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "feed_post_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_polls: {
        Row: {
          created_at: string
          id: string
          post_id: string
          question: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          question: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_polls_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_review_later_counts: {
        Row: {
          count: number
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_review_later_counts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_views: {
        Row: {
          id: string
          post_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          content: string | null
          created_at: string
          created_by: string
          id: string
          is_published: boolean | null
          scheduled_at: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_published?: boolean | null
          scheduled_at?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_published?: boolean | null
          scheduled_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      handbook_acknowledgments: {
        Row: {
          acknowledged_at: string
          handbook_id: string
          id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          handbook_id: string
          id?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          handbook_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "handbook_acknowledgments_handbook_id_fkey"
            columns: ["handbook_id"]
            isOneToOne: false
            referencedRelation: "handbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      handbooks: {
        Row: {
          ai_change_summary: string | null
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          is_shared: boolean
          previous_version_id: string | null
          shared_at: string | null
          uploaded_by: string
          version: number
        }
        Insert: {
          ai_change_summary?: string | null
          created_at?: string
          file_name: string
          file_type: string
          file_url: string
          id?: string
          is_shared?: boolean
          previous_version_id?: string | null
          shared_at?: string | null
          uploaded_by: string
          version?: number
        }
        Update: {
          ai_change_summary?: string | null
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          is_shared?: boolean
          previous_version_id?: string | null
          shared_at?: string | null
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "handbooks_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "handbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_documents: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          notes: string | null
          updated_at: string
          uploaded_by: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          notes?: string | null
          updated_at?: string
          uploaded_by: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          notes?: string | null
          updated_at?: string
          uploaded_by?: string
          user_id?: string
        }
        Relationships: []
      }
      missing_payments: {
        Row: {
          appeal_at: string | null
          appeal_count: number | null
          appeal_note: string | null
          created_at: string
          customer_name: string
          decline_reason: string | null
          discrepancy_date: string
          discrepancy_details: string
          discrepancy_types: Database["public"]["Enums"]["discrepancy_type"][]
          id: string
          job_number: string
          missing_amount: string
          mover_full_name: string
          mover_id: string
          reviewed_at: string | null
          status: Database["public"]["Enums"]["missing_payment_status"]
        }
        Insert: {
          appeal_at?: string | null
          appeal_count?: number | null
          appeal_note?: string | null
          created_at?: string
          customer_name: string
          decline_reason?: string | null
          discrepancy_date: string
          discrepancy_details: string
          discrepancy_types: Database["public"]["Enums"]["discrepancy_type"][]
          id?: string
          job_number: string
          missing_amount: string
          mover_full_name: string
          mover_id: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["missing_payment_status"]
        }
        Update: {
          appeal_at?: string | null
          appeal_count?: number | null
          appeal_note?: string | null
          created_at?: string
          customer_name?: string
          decline_reason?: string | null
          discrepancy_date?: string
          discrepancy_details?: string
          discrepancy_types?: Database["public"]["Enums"]["discrepancy_type"][]
          id?: string
          job_number?: string
          missing_amount?: string
          mover_full_name?: string
          mover_id?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["missing_payment_status"]
        }
        Relationships: []
      }
      mover_balances: {
        Row: {
          balance: number
          id: string
          mover_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          id?: string
          mover_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          id?: string
          mover_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      mover_bonus_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          description: string | null
          id: string
          mover_id: string
          reference_id: string | null
          reference_type: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          mover_id: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          mover_id?: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: string
        }
        Relationships: []
      }
      mover_feedback: {
        Row: {
          additional_notes: string | null
          created_at: string
          feedback_areas: Database["public"]["Enums"]["feedback_area"][]
          feedback_type: string
          id: string
          improvement_suggestion: string | null
          is_recurring: string
          mover_id: string
          mover_name: string
          other_area_explanation: string | null
          priority: Database["public"]["Enums"]["feedback_priority"]
          reviewed_at: string | null
          situation_explanation: string
          status: Database["public"]["Enums"]["feedback_status"]
        }
        Insert: {
          additional_notes?: string | null
          created_at?: string
          feedback_areas: Database["public"]["Enums"]["feedback_area"][]
          feedback_type: string
          id?: string
          improvement_suggestion?: string | null
          is_recurring?: string
          mover_id: string
          mover_name: string
          other_area_explanation?: string | null
          priority: Database["public"]["Enums"]["feedback_priority"]
          reviewed_at?: string | null
          situation_explanation: string
          status?: Database["public"]["Enums"]["feedback_status"]
        }
        Update: {
          additional_notes?: string | null
          created_at?: string
          feedback_areas?: Database["public"]["Enums"]["feedback_area"][]
          feedback_type?: string
          id?: string
          improvement_suggestion?: string | null
          is_recurring?: string
          mover_id?: string
          mover_name?: string
          other_area_explanation?: string | null
          priority?: Database["public"]["Enums"]["feedback_priority"]
          reviewed_at?: string | null
          situation_explanation?: string
          status?: Database["public"]["Enums"]["feedback_status"]
        }
        Relationships: []
      }
      mover_feedback_responses: {
        Row: {
          admin_id: string
          created_at: string
          feedback_id: string
          id: string
          response_message: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          feedback_id: string
          id?: string
          response_message: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          feedback_id?: string
          id?: string
          response_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "mover_feedback_responses_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "mover_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      mover_notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          notification_type: string
          reference_id: string
          reference_type: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          notification_type: string
          reference_id: string
          reference_type: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          notification_type?: string
          reference_id?: string
          reference_type?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_question_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          question_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          question_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_question_attachments_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "payment_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_question_messages: {
        Row: {
          created_at: string
          id: string
          is_admin_message: boolean
          message: string
          question_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin_message?: boolean
          message: string
          question_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin_message?: boolean
          message?: string
          question_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_question_messages_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "payment_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_questions: {
        Row: {
          created_at: string
          id: string
          job_number: string
          mover_id: string
          mover_name: string
          other_subject: string | null
          question_details: string
          reviewed_at: string | null
          status: Database["public"]["Enums"]["payment_question_status"]
          subject: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_number: string
          mover_id: string
          mover_name: string
          other_subject?: string | null
          question_details: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["payment_question_status"]
          subject: string
        }
        Update: {
          created_at?: string
          id?: string
          job_number?: string
          mover_id?: string
          mover_name?: string
          other_subject?: string | null
          question_details?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["payment_question_status"]
          subject?: string
        }
        Relationships: []
      }
      performance_misconduct_messages: {
        Row: {
          created_at: string
          id: string
          is_admin_message: boolean
          is_read: boolean
          message: string
          recipient_id: string
          report_id: string | null
          report_title: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin_message?: boolean
          is_read?: boolean
          message: string
          recipient_id: string
          report_id?: string | null
          report_title: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin_message?: boolean
          is_read?: boolean
          message?: string
          recipient_id?: string
          report_id?: string | null
          report_title?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_misconduct_messages_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "performance_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_report_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_url: string
          id: string
          report_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_url: string
          id?: string
          report_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_url?: string
          id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_report_attachments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "performance_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reports: {
        Row: {
          created_at: string
          created_by: string
          id: string
          incident_category: string
          incident_datetime: string
          incident_description: string
          reviewed_at: string | null
          severity_level: string
          taken_actions: string | null
          title: string
          worker_name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          incident_category: string
          incident_datetime: string
          incident_description: string
          reviewed_at?: string | null
          severity_level: string
          taken_actions?: string | null
          title: string
          worker_name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          incident_category?: string
          incident_datetime?: string
          incident_description?: string
          reviewed_at?: string | null
          severity_level?: string
          taken_actions?: string | null
          title?: string
          worker_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          branch: string | null
          created_at: string | null
          custom_attributes: Json | null
          email: string
          employee_number: string | null
          employment_type: string | null
          first_name: string
          hire_date: string | null
          hourly_rate: number | null
          id: string
          job_role: string | null
          last_name: string
          license_class: string | null
          license_expires: string | null
          license_number: string | null
          phone: string
          phone_type: string | null
          physical_expires: string | null
          termination_date: string | null
          title: string | null
          username: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          branch?: string | null
          created_at?: string | null
          custom_attributes?: Json | null
          email: string
          employee_number?: string | null
          employment_type?: string | null
          first_name: string
          hire_date?: string | null
          hourly_rate?: number | null
          id: string
          job_role?: string | null
          last_name: string
          license_class?: string | null
          license_expires?: string | null
          license_number?: string | null
          phone: string
          phone_type?: string | null
          physical_expires?: string | null
          termination_date?: string | null
          title?: string | null
          username: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          branch?: string | null
          created_at?: string | null
          custom_attributes?: Json | null
          email?: string
          employee_number?: string | null
          employment_type?: string | null
          first_name?: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          job_role?: string | null
          last_name?: string
          license_class?: string | null
          license_expires?: string | null
          license_number?: string | null
          phone?: string
          phone_type?: string | null
          physical_expires?: string | null
          termination_date?: string | null
          title?: string | null
          username?: string
        }
        Relationships: []
      }
      reimbursement_appeal_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_url: string
          id: string
          reimbursement_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_url: string
          id?: string
          reimbursement_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_url?: string
          id?: string
          reimbursement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reimbursement_appeal_attachments_reimbursement_id_fkey"
            columns: ["reimbursement_id"]
            isOneToOne: false
            referencedRelation: "reimbursements"
            referencedColumns: ["id"]
          },
        ]
      }
      reimbursement_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_url: string
          id: string
          reimbursement_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_url: string
          id?: string
          reimbursement_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_url?: string
          id?: string
          reimbursement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reimbursement_attachments_reimbursement_id_fkey"
            columns: ["reimbursement_id"]
            isOneToOne: false
            referencedRelation: "reimbursements"
            referencedColumns: ["id"]
          },
        ]
      }
      reimbursements: {
        Row: {
          appeal_at: string | null
          appeal_count: number | null
          appeal_note: string | null
          confirmed_at: string | null
          created_at: string | null
          customer_name: string
          decline_reason: string | null
          gas_expenses: number | null
          hotel_expenses: number | null
          id: string
          is_duplicate_job: boolean
          job_number: string
          mover_full_name: string
          mover_id: string
          other_expenses: number | null
          paid_at: string | null
          reimbursement_number: number
          road_expenses: number | null
          status: Database["public"]["Enums"]["reimbursement_status"] | null
          total_expenses: number
          truck_number: string
          zelle_info: string
        }
        Insert: {
          appeal_at?: string | null
          appeal_count?: number | null
          appeal_note?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          customer_name: string
          decline_reason?: string | null
          gas_expenses?: number | null
          hotel_expenses?: number | null
          id?: string
          is_duplicate_job?: boolean
          job_number: string
          mover_full_name: string
          mover_id: string
          other_expenses?: number | null
          paid_at?: string | null
          reimbursement_number?: number
          road_expenses?: number | null
          status?: Database["public"]["Enums"]["reimbursement_status"] | null
          total_expenses: number
          truck_number: string
          zelle_info: string
        }
        Update: {
          appeal_at?: string | null
          appeal_count?: number | null
          appeal_note?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          customer_name?: string
          decline_reason?: string | null
          gas_expenses?: number | null
          hotel_expenses?: number | null
          id?: string
          is_duplicate_job?: boolean
          job_number?: string
          mover_full_name?: string
          mover_id?: string
          other_expenses?: number | null
          paid_at?: string | null
          reimbursement_number?: number
          road_expenses?: number | null
          status?: Database["public"]["Enums"]["reimbursement_status"] | null
          total_expenses?: number
          truck_number?: string
          zelle_info?: string
        }
        Relationships: []
      }
      review_appeal_attachments: {
        Row: {
          appeal_history_id: string | null
          created_at: string | null
          file_name: string
          file_url: string
          id: string
          review_bonus_id: string
        }
        Insert: {
          appeal_history_id?: string | null
          created_at?: string | null
          file_name: string
          file_url: string
          id?: string
          review_bonus_id: string
        }
        Update: {
          appeal_history_id?: string | null
          created_at?: string | null
          file_name?: string
          file_url?: string
          id?: string
          review_bonus_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_appeal_attachments_appeal_history_id_fkey"
            columns: ["appeal_history_id"]
            isOneToOne: false
            referencedRelation: "review_bonus_appeal_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_appeal_attachments_review_bonus_id_fkey"
            columns: ["review_bonus_id"]
            isOneToOne: false
            referencedRelation: "review_bonuses"
            referencedColumns: ["id"]
          },
        ]
      }
      review_bonus_appeal_history: {
        Row: {
          appeal_at: string
          appeal_note: string
          appeal_number: number
          created_at: string
          decline_reason: string | null
          declined_at: string | null
          id: string
          review_bonus_id: string
        }
        Insert: {
          appeal_at?: string
          appeal_note: string
          appeal_number: number
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          id?: string
          review_bonus_id: string
        }
        Update: {
          appeal_at?: string
          appeal_note?: string
          appeal_number?: number
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          id?: string
          review_bonus_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_bonus_appeal_history_review_bonus_id_fkey"
            columns: ["review_bonus_id"]
            isOneToOne: false
            referencedRelation: "review_bonuses"
            referencedColumns: ["id"]
          },
        ]
      }
      review_bonuses: {
        Row: {
          appeal_at: string | null
          appeal_count: number | null
          appeal_note: string | null
          client_full_name: string
          created_at: string
          crew_member_1: string
          crew_member_2: string
          crew_member_3: string | null
          crew_member_4: string | null
          crew_member_5: string | null
          crew_member_6: string | null
          crew_member_7: string | null
          crew_member_8: string | null
          decline_reason: string | null
          foreman_name: string
          id: string
          invoice_number: string
          job_date: string
          mover_id: string
          review_month: string
          review_url: string | null
          reviewed_at: string | null
          screenshot_url: string
          status: Database["public"]["Enums"]["review_bonus_status"]
          submission_date: string
        }
        Insert: {
          appeal_at?: string | null
          appeal_count?: number | null
          appeal_note?: string | null
          client_full_name: string
          created_at?: string
          crew_member_1: string
          crew_member_2: string
          crew_member_3?: string | null
          crew_member_4?: string | null
          crew_member_5?: string | null
          crew_member_6?: string | null
          crew_member_7?: string | null
          crew_member_8?: string | null
          decline_reason?: string | null
          foreman_name: string
          id?: string
          invoice_number: string
          job_date: string
          mover_id: string
          review_month: string
          review_url?: string | null
          reviewed_at?: string | null
          screenshot_url: string
          status?: Database["public"]["Enums"]["review_bonus_status"]
          submission_date?: string
        }
        Update: {
          appeal_at?: string | null
          appeal_count?: number | null
          appeal_note?: string | null
          client_full_name?: string
          created_at?: string
          crew_member_1?: string
          crew_member_2?: string
          crew_member_3?: string | null
          crew_member_4?: string | null
          crew_member_5?: string | null
          crew_member_6?: string | null
          crew_member_7?: string | null
          crew_member_8?: string | null
          decline_reason?: string | null
          foreman_name?: string
          id?: string
          invoice_number?: string
          job_date?: string
          mover_id?: string
          review_month?: string
          review_url?: string | null
          reviewed_at?: string | null
          screenshot_url?: string
          status?: Database["public"]["Enums"]["review_bonus_status"]
          submission_date?: string
        }
        Relationships: []
      }
      signed_consent_documents: {
        Row: {
          consent_document_id: string
          document_name: string
          id: string
          mover_name: string
          signature_url: string
          signed_at: string
          signed_html_content: string | null
          user_id: string
        }
        Insert: {
          consent_document_id: string
          document_name: string
          id?: string
          mover_name: string
          signature_url: string
          signed_at?: string
          signed_html_content?: string | null
          user_id: string
        }
        Update: {
          consent_document_id?: string
          document_name?: string
          id?: string
          mover_name?: string
          signature_url?: string
          signed_at?: string
          signed_html_content?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signed_consent_documents_consent_document_id_fkey"
            columns: ["consent_document_id"]
            isOneToOne: false
            referencedRelation: "consent_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_logs: {
        Row: {
          activity_description: string
          activity_type: string
          created_at: string
          id: string
          reference_id: string | null
          reference_type: string | null
          user_id: string
        }
        Insert: {
          activity_description: string
          activity_type: string
          created_at?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          user_id: string
        }
        Update: {
          activity_description?: string
          activity_type?: string
          created_at?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_driver_status: {
        Row: {
          created_at: string
          driver_prompt_answered: boolean
          id: string
          is_driver: boolean | null
          license_uploaded_at: string | null
          license_url: string | null
          medical_card_expiration_date: string | null
          medical_card_issue_date: string | null
          medical_card_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          driver_prompt_answered?: boolean
          id?: string
          is_driver?: boolean | null
          license_uploaded_at?: string | null
          license_url?: string | null
          medical_card_expiration_date?: string | null
          medical_card_issue_date?: string | null
          medical_card_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          driver_prompt_answered?: boolean
          id?: string
          is_driver?: boolean | null
          license_uploaded_at?: string | null
          license_url?: string | null
          medical_card_expiration_date?: string | null
          medical_card_issue_date?: string | null
          medical_card_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      violence_incident_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_url: string
          id: string
          incident_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_url: string
          id?: string
          incident_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_url?: string
          id?: string
          incident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "violence_incident_attachments_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "violence_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      violence_incidents: {
        Row: {
          admin_actions: string | null
          anyone_injured: boolean
          client_name: string
          created_at: string
          damage_description: string | null
          emergency_services_called: boolean
          id: string
          incident_address: string
          incident_date: string
          incident_description: string
          incident_time: string
          incident_types: Database["public"]["Enums"]["violence_incident_type"][]
          injury_description: string | null
          job_id: string
          mover_id: string
          mover_name: string
          operations_manager_actions: string | null
          phone_number: string
          police_contacted: boolean
          property_damaged: boolean
          severity_level: Database["public"]["Enums"]["violence_severity_level"]
        }
        Insert: {
          admin_actions?: string | null
          anyone_injured?: boolean
          client_name: string
          created_at?: string
          damage_description?: string | null
          emergency_services_called?: boolean
          id?: string
          incident_address: string
          incident_date: string
          incident_description: string
          incident_time: string
          incident_types: Database["public"]["Enums"]["violence_incident_type"][]
          injury_description?: string | null
          job_id: string
          mover_id: string
          mover_name: string
          operations_manager_actions?: string | null
          phone_number: string
          police_contacted?: boolean
          property_damaged?: boolean
          severity_level: Database["public"]["Enums"]["violence_severity_level"]
        }
        Update: {
          admin_actions?: string | null
          anyone_injured?: boolean
          client_name?: string
          created_at?: string
          damage_description?: string | null
          emergency_services_called?: boolean
          id?: string
          incident_address?: string
          incident_date?: string
          incident_description?: string
          incident_time?: string
          incident_types?: Database["public"]["Enums"]["violence_incident_type"][]
          injury_description?: string | null
          job_id?: string
          mover_id?: string
          mover_name?: string
          operations_manager_actions?: string | null
          phone_number?: string
          police_contacted?: boolean
          property_damaged?: boolean
          severity_level?: Database["public"]["Enums"]["violence_severity_level"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_duplicate_invoice_number: {
        Args: { p_invoice_number: string }
        Returns: boolean
      }
      check_duplicate_review_url: {
        Args: { p_review_url: string }
        Returns: boolean
      }
      delete_user_account: {
        Args: { user_id_to_delete: string }
        Returns: undefined
      }
      get_email_by_username: {
        Args: { input_username: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_creator: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      list_chat_users_for_picker: {
        Args: { exclude_user_id?: string }
        Returns: {
          first_name: string
          id: string
          last_name: string
          roles: string[]
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "accountant"
        | "mover"
        | "operations_manager"
        | "reviews_admin"
        | "hr_manager"
        | "office_staff"
      chat_topic_type:
        | "general"
        | "reimbursement"
        | "review_bonus"
        | "missing_payment"
        | "violence_incident"
        | "performance_report"
        | "deductible"
      discrepancy_type:
        | "missing_hours"
        | "incorrect_hourly_rate"
        | "missing_tip"
        | "missing_bonus"
        | "other"
      feedback_area:
        | "operations"
        | "scheduling"
        | "equipment"
        | "pay"
        | "safety"
        | "customer_experience"
        | "communication"
        | "other"
      feedback_priority: "needs_attention_soon" | "general_improvement"
      feedback_status: "pending" | "reviewed" | "responded"
      missing_payment_status: "pending" | "confirmed" | "declined" | "appeal"
      payment_question_status: "open" | "answered" | "closed"
      reimbursement_status:
        | "pending"
        | "confirmed"
        | "paid"
        | "declined"
        | "appeal"
      review_bonus_status: "pending" | "confirmed" | "declined" | "appeal"
      violence_incident_type:
        | "verbal_threat"
        | "physical_contact"
        | "property_damage"
        | "harassment"
        | "weapon_seen"
        | "other"
      violence_severity_level: "low" | "medium" | "high" | "critical"
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
        "accountant",
        "mover",
        "operations_manager",
        "reviews_admin",
        "hr_manager",
        "office_staff",
      ],
      chat_topic_type: [
        "general",
        "reimbursement",
        "review_bonus",
        "missing_payment",
        "violence_incident",
        "performance_report",
        "deductible",
      ],
      discrepancy_type: [
        "missing_hours",
        "incorrect_hourly_rate",
        "missing_tip",
        "missing_bonus",
        "other",
      ],
      feedback_area: [
        "operations",
        "scheduling",
        "equipment",
        "pay",
        "safety",
        "customer_experience",
        "communication",
        "other",
      ],
      feedback_priority: ["needs_attention_soon", "general_improvement"],
      feedback_status: ["pending", "reviewed", "responded"],
      missing_payment_status: ["pending", "confirmed", "declined", "appeal"],
      payment_question_status: ["open", "answered", "closed"],
      reimbursement_status: [
        "pending",
        "confirmed",
        "paid",
        "declined",
        "appeal",
      ],
      review_bonus_status: ["pending", "confirmed", "declined", "appeal"],
      violence_incident_type: [
        "verbal_threat",
        "physical_contact",
        "property_damage",
        "harassment",
        "weapon_seen",
        "other",
      ],
      violence_severity_level: ["low", "medium", "high", "critical"],
    },
  },
} as const
