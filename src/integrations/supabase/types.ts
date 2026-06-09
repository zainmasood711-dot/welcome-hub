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
          archive_tags: string[]
          archiving_freshness_at: string | null
          assigned_by: string | null
          assignment_type: string
          classification_metadata: Json
          completed_at: string | null
          created_at: string
          customer_system_id: string | null
          difficulties: string | null
          engineer_id: string
          id: string
          recommendations: string | null
          scheduled_date: string | null
          started_at: string | null
          status: string
          submitted_at: string | null
          synced_at: string | null
          ticket_id: string | null
          updated_at: string
          work_done: string | null
        }
        Insert: {
          archive_tags?: string[]
          archiving_freshness_at?: string | null
          assigned_by?: string | null
          assignment_type: string
          classification_metadata?: Json
          completed_at?: string | null
          created_at?: string
          customer_system_id?: string | null
          difficulties?: string | null
          engineer_id: string
          id?: string
          recommendations?: string | null
          scheduled_date?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          synced_at?: string | null
          ticket_id?: string | null
          updated_at?: string
          work_done?: string | null
        }
        Update: {
          archive_tags?: string[]
          archiving_freshness_at?: string | null
          assigned_by?: string | null
          assignment_type?: string
          classification_metadata?: Json
          completed_at?: string | null
          created_at?: string
          customer_system_id?: string | null
          difficulties?: string | null
          engineer_id?: string
          id?: string
          recommendations?: string | null
          scheduled_date?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          synced_at?: string | null
          ticket_id?: string | null
          updated_at?: string
          work_done?: string | null
        }
        Relationships: [
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
          assignment_id: string | null
          attachable_id: string | null
          attachable_type: string | null
          classification_metadata: Json
          confidence_level: string
          confidence_score: number
          content_source: string
          created_at: string
          dedupe_signature: string | null
          description: string | null
          duplicate_of: string | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          freshness_score: number
          id: string
          last_enriched_at: string
          normalized_tags: string[]
          original_name: string | null
          quality_score: number
          related_resolution_type: string | null
          review_state: string
          ticket_id: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
          verification_state: string
        }
        Insert: {
          assignment_id?: string | null
          attachable_id?: string | null
          attachable_type?: string | null
          classification_metadata?: Json
          confidence_level?: string
          confidence_score?: number
          content_source?: string
          created_at?: string
          dedupe_signature?: string | null
          description?: string | null
          duplicate_of?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          freshness_score?: number
          id?: string
          last_enriched_at?: string
          normalized_tags?: string[]
          original_name?: string | null
          quality_score?: number
          related_resolution_type?: string | null
          review_state?: string
          ticket_id?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          verification_state?: string
        }
        Update: {
          assignment_id?: string | null
          attachable_id?: string | null
          attachable_type?: string | null
          classification_metadata?: Json
          confidence_level?: string
          confidence_score?: number
          content_source?: string
          created_at?: string
          dedupe_signature?: string | null
          description?: string | null
          duplicate_of?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          freshness_score?: number
          id?: string
          last_enriched_at?: string
          normalized_tags?: string[]
          original_name?: string | null
          quality_score?: number
          related_resolution_type?: string | null
          review_state?: string
          ticket_id?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          verification_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
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
          normalized_system_name: string | null
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
          normalized_system_name?: string | null
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
          normalized_system_name?: string | null
          notes?: string | null
          status?: string
          system_name?: string
          updated_at?: string
        }
        Relationships: [
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
          normalized_name: string | null
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
          normalized_name?: string | null
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
          normalized_name?: string | null
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
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
          normalized_code: string | null
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
          normalized_code?: string | null
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
          normalized_code?: string | null
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
      error_intelligence_alerts: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          created_by: string | null
          dedupe_key: string
          first_detected_at: string
          id: string
          last_detected_at: string
          recommendation_context: Json
          related_assignment_id: string | null
          related_customer_id: string | null
          related_customer_system_id: string | null
          related_error_code_text: string | null
          related_event_id: string | null
          related_knowledge_base_id: string | null
          related_product_id: string | null
          related_ticket_id: string | null
          resolved_at: string | null
          rule_type: Database["public"]["Enums"]["error_intelligence_alert_rule"]
          severity: Database["public"]["Enums"]["error_intelligence_severity"]
          status: Database["public"]["Enums"]["error_intelligence_status"]
          summary: string
          title: string
          trigger_count: number
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key: string
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          recommendation_context?: Json
          related_assignment_id?: string | null
          related_customer_id?: string | null
          related_customer_system_id?: string | null
          related_error_code_text?: string | null
          related_event_id?: string | null
          related_knowledge_base_id?: string | null
          related_product_id?: string | null
          related_ticket_id?: string | null
          resolved_at?: string | null
          rule_type: Database["public"]["Enums"]["error_intelligence_alert_rule"]
          severity?: Database["public"]["Enums"]["error_intelligence_severity"]
          status?: Database["public"]["Enums"]["error_intelligence_status"]
          summary: string
          title: string
          trigger_count?: number
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key?: string
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          recommendation_context?: Json
          related_assignment_id?: string | null
          related_customer_id?: string | null
          related_customer_system_id?: string | null
          related_error_code_text?: string | null
          related_event_id?: string | null
          related_knowledge_base_id?: string | null
          related_product_id?: string | null
          related_ticket_id?: string | null
          resolved_at?: string | null
          rule_type?: Database["public"]["Enums"]["error_intelligence_alert_rule"]
          severity?: Database["public"]["Enums"]["error_intelligence_severity"]
          status?: Database["public"]["Enums"]["error_intelligence_status"]
          summary?: string
          title?: string
          trigger_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "error_intelligence_alerts_related_assignment_id_fkey"
            columns: ["related_assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_intelligence_alerts_related_customer_id_fkey"
            columns: ["related_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_intelligence_alerts_related_customer_system_id_fkey"
            columns: ["related_customer_system_id"]
            isOneToOne: false
            referencedRelation: "customer_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_intelligence_alerts_related_event_id_fkey"
            columns: ["related_event_id"]
            isOneToOne: false
            referencedRelation: "error_intelligence_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_intelligence_alerts_related_knowledge_base_id_fkey"
            columns: ["related_knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_intelligence_alerts_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_intelligence_alerts_related_ticket_id_fkey"
            columns: ["related_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      error_intelligence_events: {
        Row: {
          action_hint: string | null
          assignment_id: string | null
          attachment_id: string | null
          classification: Database["public"]["Enums"]["error_intelligence_classification"]
          created_at: string
          created_by: string
          customer_id: string | null
          customer_system_id: string | null
          details: Json
          error_code_id: string | null
          error_code_text: string | null
          id: string
          knowledge_base_id: string | null
          message: string
          normalized_error_signature: string
          occurred_at: string
          product_id: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["error_intelligence_severity"]
          source: Database["public"]["Enums"]["error_intelligence_source"]
          source_ref_id: string | null
          status: Database["public"]["Enums"]["error_intelligence_status"]
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          action_hint?: string | null
          assignment_id?: string | null
          attachment_id?: string | null
          classification: Database["public"]["Enums"]["error_intelligence_classification"]
          created_at?: string
          created_by: string
          customer_id?: string | null
          customer_system_id?: string | null
          details?: Json
          error_code_id?: string | null
          error_code_text?: string | null
          id?: string
          knowledge_base_id?: string | null
          message: string
          normalized_error_signature: string
          occurred_at?: string
          product_id?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["error_intelligence_severity"]
          source: Database["public"]["Enums"]["error_intelligence_source"]
          source_ref_id?: string | null
          status?: Database["public"]["Enums"]["error_intelligence_status"]
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          action_hint?: string | null
          assignment_id?: string | null
          attachment_id?: string | null
          classification?: Database["public"]["Enums"]["error_intelligence_classification"]
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_system_id?: string | null
          details?: Json
          error_code_id?: string | null
          error_code_text?: string | null
          id?: string
          knowledge_base_id?: string | null
          message?: string
          normalized_error_signature?: string
          occurred_at?: string
          product_id?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["error_intelligence_severity"]
          source?: Database["public"]["Enums"]["error_intelligence_source"]
          source_ref_id?: string | null
          status?: Database["public"]["Enums"]["error_intelligence_status"]
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "error_intelligence_events_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_intelligence_events_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_intelligence_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_intelligence_events_customer_system_id_fkey"
            columns: ["customer_system_id"]
            isOneToOne: false
            referencedRelation: "customer_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_intelligence_events_error_code_id_fkey"
            columns: ["error_code_id"]
            isOneToOne: false
            referencedRelation: "error_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_intelligence_events_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_intelligence_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_intelligence_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          classification_metadata: Json
          confidence_level: string
          confidence_score: number
          content_source: string
          created_at: string
          created_by: string | null
          dedupe_signature: string | null
          derived_resolution_type: string | null
          duplicate_of: string | null
          effectiveness_rate: number | null
          error_code_text: string | null
          fail_count: number
          freshness_score: number
          id: string
          issue_description: string | null
          last_enriched_at: string
          last_reviewed_at: string | null
          linked_ticket_ids: string[]
          normalized_tags: string[]
          partial_fail_count: number
          product_id: string | null
          quality_score: number
          review_state: string
          search_keywords: string | null
          search_vector: unknown
          solution_steps: string | null
          source: string
          success_count: number
          title: string
          updated_at: string
          verification_state: string
        }
        Insert: {
          classification_metadata?: Json
          confidence_level?: string
          confidence_score?: number
          content_source?: string
          created_at?: string
          created_by?: string | null
          dedupe_signature?: string | null
          derived_resolution_type?: string | null
          duplicate_of?: string | null
          effectiveness_rate?: number | null
          error_code_text?: string | null
          fail_count?: number
          freshness_score?: number
          id?: string
          issue_description?: string | null
          last_enriched_at?: string
          last_reviewed_at?: string | null
          linked_ticket_ids?: string[]
          normalized_tags?: string[]
          partial_fail_count?: number
          product_id?: string | null
          quality_score?: number
          review_state?: string
          search_keywords?: string | null
          search_vector?: unknown
          solution_steps?: string | null
          source?: string
          success_count?: number
          title: string
          updated_at?: string
          verification_state?: string
        }
        Update: {
          classification_metadata?: Json
          confidence_level?: string
          confidence_score?: number
          content_source?: string
          created_at?: string
          created_by?: string | null
          dedupe_signature?: string | null
          derived_resolution_type?: string | null
          duplicate_of?: string | null
          effectiveness_rate?: number | null
          error_code_text?: string | null
          fail_count?: number
          freshness_score?: number
          id?: string
          issue_description?: string | null
          last_enriched_at?: string
          last_reviewed_at?: string | null
          linked_ticket_ids?: string[]
          normalized_tags?: string[]
          partial_fail_count?: number
          product_id?: string | null
          quality_score?: number
          review_state?: string
          search_keywords?: string | null
          search_vector?: unknown
          solution_steps?: string | null
          source?: string
          success_count?: number
          title?: string
          updated_at?: string
          verification_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
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
          context_snapshot: Json
          created_at: string
          engineer_id: string | null
          feedback_weight: number
          id: string
          is_helpful: boolean | null
          knowledge_base_id: string
          notes: string | null
          rating: string | null
          ticket_id: string | null
          user_id: string | null
        }
        Insert: {
          context_snapshot?: Json
          created_at?: string
          engineer_id?: string | null
          feedback_weight?: number
          id?: string
          is_helpful?: boolean | null
          knowledge_base_id: string
          notes?: string | null
          rating?: string | null
          ticket_id?: string | null
          user_id?: string | null
        }
        Update: {
          context_snapshot?: Json
          created_at?: string
          engineer_id?: string | null
          feedback_weight?: number
          id?: string
          is_helpful?: boolean | null
          knowledge_base_id?: string
          notes?: string | null
          rating?: string | null
          ticket_id?: string | null
          user_id?: string | null
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
        ]
      }
      notifications: {
        Row: {
          body: string | null
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
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          related_id?: string | null
          related_type?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          target_user_id?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
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
        Relationships: []
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
          normalized_model: string | null
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
          normalized_model?: string | null
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
          normalized_model?: string | null
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
          role_override: Database["public"]["Enums"]["app_role"] | null
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
          role_override?: Database["public"]["Enums"]["app_role"] | null
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
          role_override?: Database["public"]["Enums"]["app_role"] | null
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
          warranty_status: string | null
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
          warranty_status?: string | null
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
          warranty_status?: string | null
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
      tasks: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          affected_product_id: string | null
          archive_tags: string[]
          archiving_freshness_at: string | null
          category_id: string | null
          classification_metadata: Json
          closed_at: string | null
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
          remote_solution: string | null
          remote_solution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          solution_type: string | null
          status: string
          status_reason: string | null
          status_updated_at: string | null
          status_updated_by: string | null
          ticket_type: string
          updated_at: string
        }
        Insert: {
          affected_product_id?: string | null
          archive_tags?: string[]
          archiving_freshness_at?: string | null
          category_id?: string | null
          classification_metadata?: Json
          closed_at?: string | null
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
          remote_solution?: string | null
          remote_solution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          solution_type?: string | null
          status?: string
          status_reason?: string | null
          status_updated_at?: string | null
          status_updated_by?: string | null
          ticket_type: string
          updated_at?: string
        }
        Update: {
          affected_product_id?: string | null
          archive_tags?: string[]
          archiving_freshness_at?: string | null
          category_id?: string | null
          classification_metadata?: Json
          closed_at?: string | null
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
          remote_solution?: string | null
          remote_solution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          solution_type?: string | null
          status?: string
          status_reason?: string | null
          status_updated_at?: string | null
          status_updated_by?: string | null
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
          {
            foreignKeyName: "tickets_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "v_profiles_with_role"
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
      v_profiles_with_role: {
        Row: {
          created_at: string | null
          email: string | null
          engineer_id: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          phone: string | null
          primary_role: Database["public"]["Enums"]["app_role"] | null
          role_override: Database["public"]["Enums"]["app_role"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          engineer_id?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          phone?: string | null
          primary_role?: never
          role_override?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          engineer_id?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          phone?: string | null
          primary_role?: never
          role_override?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
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
    }
    Functions: {
      current_engineer_id: { Args: { _user_id: string }; Returns: string }
      evaluate_error_intelligence_alerts: {
        Args: { p_event_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalize_error_signature: {
        Args: {
          p_classification: Database["public"]["Enums"]["error_intelligence_classification"]
          p_error_code?: string
          p_message: string
        }
        Returns: string
      }
      search_knowledge_ranked: {
        Args: {
          p_affected_product_id?: string
          p_category_id?: string
          p_customer_system_id?: string
          p_error_code_id?: string
          p_error_code_text?: string
          p_exclude_knowledge_id?: string
          p_issue_text?: string
          p_limit?: number
          p_min_effectiveness?: number
          p_sort_by?: string
          p_source?: string
        }
        Returns: {
          brand_name: string
          category_id: string
          effectiveness_rate: number
          error_code_text: string
          fail_count: number
          freshness_score: number
          id: string
          issue_description: string
          match_reason: string
          match_score: number
          partial_fail_count: number
          priority_tier: number
          product_id: string
          product_model: string
          search_keywords: string
          solution_steps: string
          source: string
          success_count: number
          title: string
          updated_at: string
          usage_count: number
          why: Json
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      upsert_error_intelligence_alert: {
        Args: {
          p_created_by: string
          p_dedupe_key: string
          p_recommendation_context: Json
          p_related_assignment_id: string
          p_related_customer_id: string
          p_related_customer_system_id: string
          p_related_error_code_text: string
          p_related_event_id: string
          p_related_knowledge_base_id: string
          p_related_product_id: string
          p_related_ticket_id: string
          p_rule_type: Database["public"]["Enums"]["error_intelligence_alert_rule"]
          p_severity: Database["public"]["Enums"]["error_intelligence_severity"]
          p_summary: string
          p_title: string
        }
        Returns: undefined
      }
      user_primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      app_role: "support_engineer" | "field_engineer" | "manager"
      error_intelligence_alert_rule:
        | "repeated_same_issue_customer_system"
        | "repeated_error_code_same_model"
        | "growing_failure_frequency"
        | "knowledge_failure_spike"
        | "attachment_upload_spike"
        | "unresolved_ticket_aging_symptoms"
      error_intelligence_classification:
        | "application_error"
        | "validation_error"
        | "workflow_error"
        | "sync_error"
        | "upload_error"
        | "data_consistency_issue"
        | "repeated_operational_issue"
        | "low_effectiveness_knowledge_issue"
      error_intelligence_severity: "low" | "medium" | "high" | "critical"
      error_intelligence_source:
        | "runtime"
        | "ticket_workflow"
        | "assignment_workflow"
        | "attachment_workflow"
        | "offline_sync"
        | "knowledge_workflow"
        | "reporting"
      error_intelligence_status:
        | "open"
        | "acknowledged"
        | "resolved"
        | "ignored"
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
      error_intelligence_alert_rule: [
        "repeated_same_issue_customer_system",
        "repeated_error_code_same_model",
        "growing_failure_frequency",
        "knowledge_failure_spike",
        "attachment_upload_spike",
        "unresolved_ticket_aging_symptoms",
      ],
      error_intelligence_classification: [
        "application_error",
        "validation_error",
        "workflow_error",
        "sync_error",
        "upload_error",
        "data_consistency_issue",
        "repeated_operational_issue",
        "low_effectiveness_knowledge_issue",
      ],
      error_intelligence_severity: ["low", "medium", "high", "critical"],
      error_intelligence_source: [
        "runtime",
        "ticket_workflow",
        "assignment_workflow",
        "attachment_workflow",
        "offline_sync",
        "knowledge_workflow",
        "reporting",
      ],
      error_intelligence_status: [
        "open",
        "acknowledged",
        "resolved",
        "ignored",
      ],
    },
  },
} as const
