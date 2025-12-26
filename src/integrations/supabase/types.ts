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
      missing_payments: {
        Row: {
          appeal_at: string | null
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
          severity_level?: string
          taken_actions?: string | null
          title?: string
          worker_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          first_name: string
          hourly_rate: number | null
          id: string
          last_name: string
          phone: string
          username: string
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name: string
          hourly_rate?: number | null
          id: string
          last_name: string
          phone: string
          username: string
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string
          hourly_rate?: number | null
          id?: string
          last_name?: string
          phone?: string
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
          appeal_note: string | null
          confirmed_at: string | null
          created_at: string | null
          customer_name: string
          decline_reason: string | null
          gas_expenses: number | null
          hotel_expenses: number | null
          id: string
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
          appeal_note?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          customer_name: string
          decline_reason?: string | null
          gas_expenses?: number | null
          hotel_expenses?: number | null
          id?: string
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
          appeal_note?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          customer_name?: string
          decline_reason?: string | null
          gas_expenses?: number | null
          hotel_expenses?: number | null
          id?: string
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
          created_at: string | null
          file_name: string
          file_url: string
          id: string
          review_bonus_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_url: string
          id?: string
          review_bonus_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_url?: string
          id?: string
          review_bonus_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_appeal_attachments_review_bonus_id_fkey"
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
          appeal_note: string | null
          client_full_name: string
          created_at: string
          crew_member_1: string
          crew_member_2: string
          crew_member_3: string
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
          appeal_note?: string | null
          client_full_name: string
          created_at?: string
          crew_member_1: string
          crew_member_2: string
          crew_member_3: string
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
          appeal_note?: string | null
          client_full_name?: string
          created_at?: string
          crew_member_1?: string
          crew_member_2?: string
          crew_member_3?: string
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
    }
    Enums: {
      app_role:
        | "admin"
        | "accountant"
        | "mover"
        | "operations_manager"
        | "reviews_admin"
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
      missing_payment_status: "pending" | "confirmed" | "declined" | "appeal"
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
      missing_payment_status: ["pending", "confirmed", "declined", "appeal"],
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
