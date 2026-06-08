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
      assignments: {
        Row: {
          assigned_by: string | null
          assignment_type: string
          created_at: string
          customer_system_id: string | null
          difficulties: string | null
          engineer_id: string
          id: string
          recommendations: string | null
          scheduled_date: string | null
          status: string
          submitted_at: string | null
          synced_at: string | null
          ticket_id: string | null
          updated_at: string
          work_done: string | null
        }
        Insert: {
          assigned_by?: string | null
          assignment_type: string
          created_at?: string
          customer_system_id?: string | null
          difficulties?: string | null
          engineer_id: string
          id?: string
          recommendations?: string | null
          scheduled_date?: string | null
          status?: string
          submitted_at?: string | null
          synced_at?: string | null
          ticket_id?: string | null
          updated_at?: string
          work_done?: string | null
        }
        Update: {
          assigned_by?: string | null
          assignment_type?: string
          created_at?: string
          customer_system_id?: string | null
          difficulties?: string | null
          engineer_id?: string
          id?: string
          recommendations?: string | null
          scheduled_date?: string | null
          status?: string
          submitted_at?: string | null
          synced_at?: string | null
          ticket_id?: string | null
          updated_at?: string
          work_done?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_customer_system_id_fkey"
            columns: ["customer_system_id"]
            isOneToOne: false
            referencedRelation: "customer_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          attachable_id: string
          attachable_type: string
          created_at: string
          description: string | null
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          original_name: string | null
          uploaded_by: string | null
        }
        Insert: {
          attachable_id: string
          attachable_type: string
          created_at?: string
          description?: string | null
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          original_name?: string | null
          uploaded_by?: string | null
        }
        Update: {
          attachable_id?: string
          attachable_type?: string
          created_at?: string
          description?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          original_name?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_systems: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          installation_date: string | null
          notes: string | null
          status: string
          system_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          installation_date?: string | null
          notes?: string | null
          status?: string
          system_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          installation_date?: string | null
          notes?: string | null
          status?: string
          system_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_systems_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_systems_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          governorate: string | null
          id: string
          location_coordinates: string | null
          name: string
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          governorate?: string | null
          id?: string
          location_coordinates?: string | null
          name: string
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          governorate?: string | null
          id?: string
          location_coordinates?: string | null
          name?: string
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engineers: {
        Row: {
          availability_status: string
          city: string | null
          created_at: string
          email: string | null
          governorate: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          specialization: string | null
          type: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          availability_status?: string
          city?: string | null
          created_at?: string
          email?: string | null
          governorate?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          specialization?: string | null
          type?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          availability_status?: string
          city?: string | null
          created_at?: string
          email?: string | null
          governorate?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          specialization?: string | null
          type?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      error_codes: {
        Row: {
          category: string
          code: string
          common_causes: string | null
          created_at: string
          description: string | null
          id: string
          occurrences_count: number
          product_id: string | null
          recommended_solution: string | null
          updated_at: string
        }
        Insert: {
          category: string
          code: string
          common_causes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          occurrences_count?: number
          product_id?: string | null
          recommended_solution?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          common_causes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          occurrences_count?: number
          product_id?: string | null
          recommended_solution?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "error_codes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          created_at: string
          created_by: string | null
          effectiveness_rate: number
          error_code_text: string | null
          fail_count: number
          id: string
          issue_description: string
          linked_ticket_ids: Json
          product_id: string | null
          search_keywords: string | null
          solution_steps: string
          source: string
          success_count: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effectiveness_rate?: number
          error_code_text?: string | null
          fail_count?: number
          id?: string
          issue_description: string
          linked_ticket_ids?: Json
          product_id?: string | null
          search_keywords?: string | null
          solution_steps: string
          source?: string
          success_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effectiveness_rate?: number
          error_code_text?: string | null
          fail_count?: number
          id?: string
          issue_description?: string
          linked_ticket_ids?: Json
          product_id?: string | null
          search_keywords?: string | null
          solution_steps?: string
          source?: string
          success_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_base_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_feedback: {
        Row: {
          created_at: string
          engineer_id: string
          id: string
          knowledge_base_id: string
          notes: string | null
          rating: string
          ticket_id: string | null
        }
        Insert: {
          created_at?: string
          engineer_id: string
          id?: string
          knowledge_base_id: string
          notes?: string | null
          rating: string
          ticket_id?: string | null
        }
        Update: {
          created_at?: string
          engineer_id?: string
          id?: string
          knowledge_base_id?: string
          notes?: string | null
          rating?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_feedback_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_feedback_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_feedback_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          id: string
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          related_id: string | null
          related_type: string | null
          target_role: Database["public"]["Enums"]["app_role"] | null
          target_user_id: string | null
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          related_id?: string | null
          related_type?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          target_user_id?: string | null
          title: string
          type?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          related_id?: string | null
          related_type?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          target_user_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name_ar: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_ar: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name_ar?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          brand_id: string
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          model: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          model: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          model?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          engineer_id: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          engineer_id?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          engineer_id?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      system_assets: {
        Row: {
          created_at: string
          customer_system_id: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          serial_number: string | null
          updated_at: string
          warranty_status: string
        }
        Insert: {
          created_at?: string
          customer_system_id: string
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          serial_number?: string | null
          updated_at?: string
          warranty_status?: string
        }
        Update: {
          created_at?: string
          customer_system_id?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          serial_number?: string | null
          updated_at?: string
          warranty_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_assets_customer_system_id_fkey"
            columns: ["customer_system_id"]
            isOneToOne: false
            referencedRelation: "customer_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          affected_product_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          customer_system_id: string | null
          description: string
          error_code_id: string | null
          error_code_text: string | null
          id: string
          knowledge_base_id: string | null
          priority: string
          remote_solution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          solution_type: string | null
          status: string
          ticket_type: string
          updated_at: string
        }
        Insert: {
          affected_product_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          customer_system_id?: string | null
          description: string
          error_code_id?: string | null
          error_code_text?: string | null
          id?: string
          knowledge_base_id?: string | null
          priority?: string
          remote_solution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          solution_type?: string | null
          status: string
          ticket_type: string
          updated_at?: string
        }
        Update: {
          affected_product_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customer_system_id?: string | null
          description?: string
          error_code_id?: string | null
          error_code_text?: string | null
          id?: string
          knowledge_base_id?: string | null
          priority?: string
          remote_solution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          solution_type?: string | null
          status?: string
          ticket_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_affected_product_id_fkey"
            columns: ["affected_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_customer_system_id_fkey"
            columns: ["customer_system_id"]
            isOneToOne: false
            referencedRelation: "customer_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_error_code_id_fkey"
            columns: ["error_code_id"]
            isOneToOne: false
            referencedRelation: "error_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_attachment_path: { Args: { _path: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "support_engineer" | "field_engineer" | "manager"
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
      app_role: ["support_engineer", "field_engineer", "manager"],
    },
  },
} as const
