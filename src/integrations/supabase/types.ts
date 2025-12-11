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
      profiles: {
        Row: {
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string
          username: string
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string
          username: string
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string
          username?: string
        }
        Relationships: []
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
      review_bonuses: {
        Row: {
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
      app_role: "admin" | "accountant" | "mover"
      reimbursement_status: "pending" | "confirmed" | "paid" | "declined"
      review_bonus_status: "pending" | "confirmed" | "declined"
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
      app_role: ["admin", "accountant", "mover"],
      reimbursement_status: ["pending", "confirmed", "paid", "declined"],
      review_bonus_status: ["pending", "confirmed", "declined"],
    },
  },
} as const
