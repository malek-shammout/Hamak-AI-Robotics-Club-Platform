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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      application_score_factors: {
        Row: {
          application_id: string
          computed_at: string
          raw_value: number | null
          readiness_factor_id: string
          weighted_value: number | null
        }
        Insert: {
          application_id: string
          computed_at?: string
          raw_value?: number | null
          readiness_factor_id: string
          weighted_value?: number | null
        }
        Update: {
          application_id?: string
          computed_at?: string
          raw_value?: number | null
          readiness_factor_id?: string
          weighted_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "application_score_factors_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_score_factors_readiness_factor_id_fkey"
            columns: ["readiness_factor_id"]
            isOneToOne: false
            referencedRelation: "readiness_factors"
            referencedColumns: ["id"]
          },
        ]
      }
      application_status_history: {
        Row: {
          application_id: string
          changed_at: string
          changed_by: string | null
          from_status: string | null
          id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          application_id: string
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          reason?: string | null
          to_status: string
        }
        Update: {
          application_id?: string
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          applicant_user_id: string
          background_snapshot: Json
          cohort_id: string
          decided_at: string | null
          decided_by: string | null
          id: string
          offer_expires_at: string | null
          offer_issued_at: string | null
          rank_position: number | null
          readiness_score: number | null
          rejection_reason_id: string | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string
          updated_at: string
          waitlist_rank: number | null
        }
        Insert: {
          applicant_user_id: string
          background_snapshot?: Json
          cohort_id: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          offer_expires_at?: string | null
          offer_issued_at?: string | null
          rank_position?: number | null
          readiness_score?: number | null
          rejection_reason_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          updated_at?: string
          waitlist_rank?: number | null
        }
        Update: {
          applicant_user_id?: string
          background_snapshot?: Json
          cohort_id?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          offer_expires_at?: string | null
          offer_issued_at?: string | null
          rank_position?: number | null
          readiness_score?: number | null
          rejection_reason_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          updated_at?: string
          waitlist_rank?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_applicant_user_id_fkey"
            columns: ["applicant_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "v_cohort_funnel"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "applications_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_rejection_reason_id_fkey"
            columns: ["rejection_reason_id"]
            isOneToOne: false
            referencedRelation: "rejection_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      article_categories: {
        Row: {
          code: string
          id: string
          name_ar: string
          name_en: string
        }
        Insert: {
          code: string
          id?: string
          name_ar: string
          name_en: string
        }
        Update: {
          code?: string
          id?: string
          name_ar?: string
          name_en?: string
        }
        Relationships: []
      }
      article_tags: {
        Row: {
          article_id: string
          tag_id: string
        }
        Insert: {
          article_id: string
          tag_id: string
        }
        Update: {
          article_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_tags_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          article_category_id: string | null
          author_user_id: string | null
          body: string | null
          cover_media_id: string | null
          created_at: string
          id: string
          locale: string
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          published_by: string | null
          review_comments: string | null
          scheduled_publish_at: string | null
          slug: string
          summary: string | null
          title: string
          translation_group_id: string
          updated_at: string
        }
        Insert: {
          article_category_id?: string | null
          author_user_id?: string | null
          body?: string | null
          cover_media_id?: string | null
          created_at?: string
          id?: string
          locale: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          review_comments?: string | null
          scheduled_publish_at?: string | null
          slug: string
          summary?: string | null
          title: string
          translation_group_id?: string
          updated_at?: string
        }
        Update: {
          article_category_id?: string | null
          author_user_id?: string | null
          body?: string | null
          cover_media_id?: string | null
          created_at?: string
          id?: string
          locale?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          review_comments?: string | null
          scheduled_publish_at?: string | null
          slug?: string
          summary?: string | null
          title?: string
          translation_group_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_article_category_id_fkey"
            columns: ["article_category_id"]
            isOneToOne: false
            referencedRelation: "article_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_categories: {
        Row: {
          code: string
          id: string
          name_ar: string
          name_en: string
        }
        Insert: {
          code: string
          id?: string
          name_ar: string
          name_en: string
        }
        Update: {
          code?: string
          id?: string
          name_ar?: string
          name_en?: string
        }
        Relationships: []
      }
      asset_incidents: {
        Row: {
          checkout_line_id: string
          description: string
          evidence_media_id: string | null
          id: string
          reported_at: string
          reported_by: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["asset_incident_status"]
        }
        Insert: {
          checkout_line_id: string
          description: string
          evidence_media_id?: string | null
          id?: string
          reported_at?: string
          reported_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["asset_incident_status"]
        }
        Update: {
          checkout_line_id?: string
          description?: string
          evidence_media_id?: string | null
          id?: string
          reported_at?: string
          reported_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["asset_incident_status"]
        }
        Relationships: [
          {
            foreignKeyName: "asset_incidents_checkout_line_id_fkey"
            columns: ["checkout_line_id"]
            isOneToOne: false
            referencedRelation: "checkout_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_incidents_checkout_line_id_fkey"
            columns: ["checkout_line_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_outstanding_items"
            referencedColumns: ["checkout_line_id"]
          },
          {
            foreignKeyName: "asset_incidents_evidence_media_id_fkey"
            columns: ["evidence_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_types: {
        Row: {
          asset_category_id: string
          created_at: string
          currency: string
          datasheet_url: string | null
          id: string
          is_consumable: boolean
          low_stock_threshold: number
          manufacturer: string | null
          model: string | null
          name: string
          specifications: Json
          tracking_mode: Database["public"]["Enums"]["asset_tracking_mode"]
          unit_cost: number | null
          unit_of_measure: Database["public"]["Enums"]["asset_unit_of_measure"]
        }
        Insert: {
          asset_category_id: string
          created_at?: string
          currency?: string
          datasheet_url?: string | null
          id?: string
          is_consumable?: boolean
          low_stock_threshold?: number
          manufacturer?: string | null
          model?: string | null
          name: string
          specifications?: Json
          tracking_mode: Database["public"]["Enums"]["asset_tracking_mode"]
          unit_cost?: number | null
          unit_of_measure?: Database["public"]["Enums"]["asset_unit_of_measure"]
        }
        Update: {
          asset_category_id?: string
          created_at?: string
          currency?: string
          datasheet_url?: string | null
          id?: string
          is_consumable?: boolean
          low_stock_threshold?: number
          manufacturer?: string | null
          model?: string | null
          name?: string
          specifications?: Json
          tracking_mode?: Database["public"]["Enums"]["asset_tracking_mode"]
          unit_cost?: number | null
          unit_of_measure?: Database["public"]["Enums"]["asset_unit_of_measure"]
        }
        Relationships: [
          {
            foreignKeyName: "asset_types_asset_category_id_fkey"
            columns: ["asset_category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_units: {
        Row: {
          acquisition_date: string | null
          acquisition_source: string | null
          asset_tag: string
          asset_type_id: string
          condition: Database["public"]["Enums"]["asset_condition"]
          cost_center: string | null
          created_at: string
          current_location_id: string | null
          id: string
          retire_reason: string | null
          retired_at: string | null
          status: Database["public"]["Enums"]["asset_unit_status"]
        }
        Insert: {
          acquisition_date?: string | null
          acquisition_source?: string | null
          asset_tag: string
          asset_type_id: string
          condition?: Database["public"]["Enums"]["asset_condition"]
          cost_center?: string | null
          created_at?: string
          current_location_id?: string | null
          id?: string
          retire_reason?: string | null
          retired_at?: string | null
          status?: Database["public"]["Enums"]["asset_unit_status"]
        }
        Update: {
          acquisition_date?: string | null
          acquisition_source?: string | null
          asset_tag?: string
          asset_type_id?: string
          condition?: Database["public"]["Enums"]["asset_condition"]
          cost_center?: string | null
          created_at?: string
          current_location_id?: string | null
          id?: string
          retire_reason?: string | null
          retired_at?: string | null
          status?: Database["public"]["Enums"]["asset_unit_status"]
        }
        Relationships: [
          {
            foreignKeyName: "asset_units_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_units_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "v_asset_availability"
            referencedColumns: ["asset_type_id"]
          },
          {
            foreignKeyName: "asset_units_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_answers: {
        Row: {
          answer_payload: Json | null
          auto_score: number | null
          awarded_score: number | null
          graded_at: string | null
          graded_by: string | null
          grader_comment: string | null
          id: string
          is_override: boolean
          original_score: number | null
          override_reason: string | null
          question_id: string
          selected_option_id: string | null
          test_attempt_id: string
        }
        Insert: {
          answer_payload?: Json | null
          auto_score?: number | null
          awarded_score?: number | null
          graded_at?: string | null
          graded_by?: string | null
          grader_comment?: string | null
          id?: string
          is_override?: boolean
          original_score?: number | null
          override_reason?: string | null
          question_id: string
          selected_option_id?: string | null
          test_attempt_id: string
        }
        Update: {
          answer_payload?: Json | null
          auto_score?: number | null
          awarded_score?: number | null
          graded_at?: string | null
          graded_by?: string | null
          grader_comment?: string | null
          id?: string
          is_override?: boolean
          original_score?: number | null
          override_reason?: string | null
          question_id?: string
          selected_option_id?: string | null
          test_attempt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_answers_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "question_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_test_attempt_id_fkey"
            columns: ["test_attempt_id"]
            isOneToOne: false
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          amended_at: string | null
          amendment_reason: string | null
          cohort_session_id: string
          enrollment_id: string
          id: string
          note: string | null
          recorded_at: string
          recorded_by: string | null
          state: Database["public"]["Enums"]["attendance_state"]
        }
        Insert: {
          amended_at?: string | null
          amendment_reason?: string | null
          cohort_session_id: string
          enrollment_id: string
          id?: string
          note?: string | null
          recorded_at?: string
          recorded_by?: string | null
          state: Database["public"]["Enums"]["attendance_state"]
        }
        Update: {
          amended_at?: string | null
          amendment_reason?: string | null
          cohort_session_id?: string
          enrollment_id?: string
          id?: string
          note?: string | null
          recorded_at?: string
          recorded_by?: string | null
          state?: Database["public"]["Enums"]["attendance_state"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_cohort_session_id_fkey"
            columns: ["cohort_session_id"]
            isOneToOne: false
            referencedRelation: "cohort_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_attendance"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          is_override: boolean
          justification: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          is_override?: boolean
          justification?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          is_override?: boolean
          justification?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      award_recipients: {
        Row: {
          award_id: string
          role_note: string | null
          user_id: string
        }
        Insert: {
          award_id: string
          role_note?: string | null
          user_id: string
        }
        Update: {
          award_id?: string
          role_note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "award_recipients_award_id_fkey"
            columns: ["award_id"]
            isOneToOne: false
            referencedRelation: "awards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "award_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      awards: {
        Row: {
          awarded_on: string | null
          awarding_body: string | null
          competition: string | null
          created_at: string
          event_id: string | null
          evidence_media_id: string | null
          id: string
          level: Database["public"]["Enums"]["award_level"]
          project_id: string | null
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          rank_place: string | null
          title: string
        }
        Insert: {
          awarded_on?: string | null
          awarding_body?: string | null
          competition?: string | null
          created_at?: string
          event_id?: string | null
          evidence_media_id?: string | null
          id?: string
          level?: Database["public"]["Enums"]["award_level"]
          project_id?: string | null
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          rank_place?: string | null
          title: string
        }
        Update: {
          awarded_on?: string | null
          awarding_body?: string | null
          competition?: string | null
          created_at?: string
          event_id?: string | null
          evidence_media_id?: string | null
          id?: string
          level?: Database["public"]["Enums"]["award_level"]
          project_id?: string | null
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          rank_place?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "awards_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "awards_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_attendance_metrics"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "awards_evidence_media_id_fkey"
            columns: ["evidence_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "awards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_stock: {
        Row: {
          asset_type_id: string
          id: string
          quantity_on_hand: number
          quantity_reserved: number
          storage_location_id: string
          updated_at: string
        }
        Insert: {
          asset_type_id: string
          id?: string
          quantity_on_hand?: number
          quantity_reserved?: number
          storage_location_id: string
          updated_at?: string
        }
        Update: {
          asset_type_id?: string
          id?: string
          quantity_on_hand?: number
          quantity_reserved?: number
          storage_location_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_stock_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_stock_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "v_asset_availability"
            referencedColumns: ["asset_type_id"]
          },
          {
            foreignKeyName: "bulk_stock_storage_location_id_fkey"
            columns: ["storage_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_verifications: {
        Row: {
          certificate_id: string
          id: string
          source_fingerprint: string | null
          verified_at: string
        }
        Insert: {
          certificate_id: string
          id?: string
          source_fingerprint?: string | null
          verified_at?: string
        }
        Update: {
          certificate_id?: string
          id?: string
          source_fingerprint?: string | null
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_verifications_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          clearance_record_id: string
          clearance_status: Database["public"]["Enums"]["clearance_status"]
          document_media_id: string | null
          enrollment_id: string
          id: string
          issued_at: string
          issued_by: string | null
          issued_under_override: boolean
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          serial_no: string
          status: Database["public"]["Enums"]["certificate_status"]
          supersedes_certificate_id: string | null
          verification_code: string
        }
        Insert: {
          clearance_record_id: string
          clearance_status: Database["public"]["Enums"]["clearance_status"]
          document_media_id?: string | null
          enrollment_id: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          issued_under_override?: boolean
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          serial_no: string
          status?: Database["public"]["Enums"]["certificate_status"]
          supersedes_certificate_id?: string | null
          verification_code?: string
        }
        Update: {
          clearance_record_id?: string
          clearance_status?: Database["public"]["Enums"]["clearance_status"]
          document_media_id?: string | null
          enrollment_id?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          issued_under_override?: boolean
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          serial_no?: string
          status?: Database["public"]["Enums"]["certificate_status"]
          supersedes_certificate_id?: string | null
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_document_media_id_fkey"
            columns: ["document_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "v_enrollment_attendance"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "certificates_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_supersedes_certificate_id_fkey"
            columns: ["supersedes_certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cert_clearance_approved"
            columns: ["clearance_record_id", "clearance_status"]
            isOneToOne: false
            referencedRelation: "clearance_records"
            referencedColumns: ["id", "status"]
          },
        ]
      }
      checkout_lines: {
        Row: {
          asset_type_id: string
          asset_unit_id: string | null
          checkout_id: string
          condition_at_issue: Database["public"]["Enums"]["checkout_line_condition"]
          condition_at_return:
            | Database["public"]["Enums"]["asset_condition"]
            | null
          evidence_media_id: string | null
          id: string
          inspection_notes: string | null
          quantity: number
          received_by: string | null
          returned_at: string | null
          status: Database["public"]["Enums"]["checkout_line_status"]
        }
        Insert: {
          asset_type_id: string
          asset_unit_id?: string | null
          checkout_id: string
          condition_at_issue?: Database["public"]["Enums"]["checkout_line_condition"]
          condition_at_return?:
            | Database["public"]["Enums"]["asset_condition"]
            | null
          evidence_media_id?: string | null
          id?: string
          inspection_notes?: string | null
          quantity?: number
          received_by?: string | null
          returned_at?: string | null
          status?: Database["public"]["Enums"]["checkout_line_status"]
        }
        Update: {
          asset_type_id?: string
          asset_unit_id?: string | null
          checkout_id?: string
          condition_at_issue?: Database["public"]["Enums"]["checkout_line_condition"]
          condition_at_return?:
            | Database["public"]["Enums"]["asset_condition"]
            | null
          evidence_media_id?: string | null
          id?: string
          inspection_notes?: string | null
          quantity?: number
          received_by?: string | null
          returned_at?: string | null
          status?: Database["public"]["Enums"]["checkout_line_status"]
        }
        Relationships: [
          {
            foreignKeyName: "checkout_lines_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_lines_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "v_asset_availability"
            referencedColumns: ["asset_type_id"]
          },
          {
            foreignKeyName: "checkout_lines_asset_unit_id_fkey"
            columns: ["asset_unit_id"]
            isOneToOne: false
            referencedRelation: "asset_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_lines_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_lines_evidence_media_id_fkey"
            columns: ["evidence_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_lines_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      checkouts: {
        Row: {
          acknowledged_at: string | null
          checkout_no: string
          custody_type: Database["public"]["Enums"]["custody_type"]
          due_at: string
          enrollment_id: string | null
          holder_user_id: string
          id: string
          issued_at: string
          issued_by: string | null
          issued_under_override: boolean
          override_justification: string | null
          requisition_id: string | null
          status: Database["public"]["Enums"]["checkout_status"]
        }
        Insert: {
          acknowledged_at?: string | null
          checkout_no: string
          custody_type: Database["public"]["Enums"]["custody_type"]
          due_at: string
          enrollment_id?: string | null
          holder_user_id: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          issued_under_override?: boolean
          override_justification?: string | null
          requisition_id?: string | null
          status?: Database["public"]["Enums"]["checkout_status"]
        }
        Update: {
          acknowledged_at?: string | null
          checkout_no?: string
          custody_type?: Database["public"]["Enums"]["custody_type"]
          due_at?: string
          enrollment_id?: string | null
          holder_user_id?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          issued_under_override?: boolean
          override_justification?: string | null
          requisition_id?: string | null
          status?: Database["public"]["Enums"]["checkout_status"]
        }
        Relationships: [
          {
            foreignKeyName: "checkouts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_attendance"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "checkouts_holder_user_id_fkey"
            columns: ["holder_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      clearance_blockers: {
        Row: {
          blocker_code: Database["public"]["Enums"]["clearance_blocker_code"]
          clearance_record_id: string
          detail_ar: string | null
          detail_en: string | null
          id: string
          raised_at: string
          reference_entity: string | null
          reference_id: string | null
          resolved_at: string | null
        }
        Insert: {
          blocker_code: Database["public"]["Enums"]["clearance_blocker_code"]
          clearance_record_id: string
          detail_ar?: string | null
          detail_en?: string | null
          id?: string
          raised_at?: string
          reference_entity?: string | null
          reference_id?: string | null
          resolved_at?: string | null
        }
        Update: {
          blocker_code?: Database["public"]["Enums"]["clearance_blocker_code"]
          clearance_record_id?: string
          detail_ar?: string | null
          detail_en?: string | null
          id?: string
          raised_at?: string
          reference_entity?: string | null
          reference_id?: string | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clearance_blockers_clearance_record_id_fkey"
            columns: ["clearance_record_id"]
            isOneToOne: false
            referencedRelation: "clearance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      clearance_records: {
        Row: {
          advisory_outstanding_elsewhere: boolean
          approved_at: string | null
          approved_by: string | null
          created_at: string
          enrollment_id: string
          id: string
          is_override: boolean
          override_justification: string | null
          precondition_snapshot: Json
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: Database["public"]["Enums"]["clearance_status"]
          updated_at: string
          withheld_at: string | null
          withheld_by: string | null
        }
        Insert: {
          advisory_outstanding_elsewhere?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          is_override?: boolean
          override_justification?: string | null
          precondition_snapshot?: Json
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: Database["public"]["Enums"]["clearance_status"]
          updated_at?: string
          withheld_at?: string | null
          withheld_by?: string | null
        }
        Update: {
          advisory_outstanding_elsewhere?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          is_override?: boolean
          override_justification?: string | null
          precondition_snapshot?: Json
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: Database["public"]["Enums"]["clearance_status"]
          updated_at?: string
          withheld_at?: string | null
          withheld_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clearance_records_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clearance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clearance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "v_enrollment_attendance"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "clearance_records_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clearance_records_withheld_by_fkey"
            columns: ["withheld_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_sessions: {
        Row: {
          cohort_id: string
          course_module_id: string | null
          duration_minutes: number
          id: string
          location: string | null
          scheduled_at: string
          session_no: number
          status: Database["public"]["Enums"]["cohort_session_status"]
        }
        Insert: {
          cohort_id: string
          course_module_id?: string | null
          duration_minutes: number
          id?: string
          location?: string | null
          scheduled_at: string
          session_no: number
          status?: Database["public"]["Enums"]["cohort_session_status"]
        }
        Update: {
          cohort_id?: string
          course_module_id?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          scheduled_at?: string
          session_no?: number
          status?: Database["public"]["Enums"]["cohort_session_status"]
        }
        Relationships: [
          {
            foreignKeyName: "cohort_sessions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_sessions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "v_cohort_funnel"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "cohort_sessions_course_module_id_fkey"
            columns: ["course_module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          application_closes_at: string | null
          application_opens_at: string | null
          capacity: number
          code: string
          course_id: string
          created_at: string
          created_by: string | null
          ends_on: string | null
          id: string
          min_attendance_pct: number
          offer_confirmation_hours: number
          starts_on: string | null
          status: Database["public"]["Enums"]["cohort_status"]
          waitlist_capacity: number
        }
        Insert: {
          application_closes_at?: string | null
          application_opens_at?: string | null
          capacity: number
          code: string
          course_id: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          min_attendance_pct?: number
          offer_confirmation_hours?: number
          starts_on?: string | null
          status?: Database["public"]["Enums"]["cohort_status"]
          waitlist_capacity?: number
        }
        Update: {
          application_closes_at?: string | null
          application_opens_at?: string | null
          capacity?: number
          code?: string
          course_id?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          min_attendance_pct?: number
          offer_confirmation_hours?: number
          starts_on?: string | null
          status?: Database["public"]["Enums"]["cohort_status"]
          waitlist_capacity?: number
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohorts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          consultation_request_id: string
          decline_reason: string | null
          expert_user_id: string
          id: string
          released_at: string | null
          response_due_at: string | null
          state: Database["public"]["Enums"]["consultation_assignment_state"]
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          consultation_request_id: string
          decline_reason?: string | null
          expert_user_id: string
          id?: string
          released_at?: string | null
          response_due_at?: string | null
          state?: Database["public"]["Enums"]["consultation_assignment_state"]
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          consultation_request_id?: string
          decline_reason?: string | null
          expert_user_id?: string
          id?: string
          released_at?: string | null
          response_due_at?: string | null
          state?: Database["public"]["Enums"]["consultation_assignment_state"]
        }
        Relationships: [
          {
            foreignKeyName: "consultation_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_assignments_consultation_request_id_fkey"
            columns: ["consultation_request_id"]
            isOneToOne: false
            referencedRelation: "consultation_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_assignments_expert_user_id_fkey"
            columns: ["expert_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_attachments: {
        Row: {
          consultation_message_id: string
          filename: string | null
          media_asset_id: string
        }
        Insert: {
          consultation_message_id: string
          filename?: string | null
          media_asset_id: string
        }
        Update: {
          consultation_message_id?: string
          filename?: string | null
          media_asset_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_attachments_consultation_message_id_fkey"
            columns: ["consultation_message_id"]
            isOneToOne: false
            referencedRelation: "consultation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_attachments_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_messages: {
        Row: {
          body: string
          consultation_request_id: string
          id: string
          read_at: string | null
          sender_user_id: string
          sent_at: string
        }
        Insert: {
          body: string
          consultation_request_id: string
          id?: string
          read_at?: string | null
          sender_user_id: string
          sent_at?: string
        }
        Update: {
          body?: string
          consultation_request_id?: string
          id?: string
          read_at?: string | null
          sender_user_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_messages_consultation_request_id_fkey"
            columns: ["consultation_request_id"]
            isOneToOne: false
            referencedRelation: "consultation_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_request_domains: {
        Row: {
          consultation_request_id: string
          expertise_domain_id: string
        }
        Insert: {
          consultation_request_id: string
          expertise_domain_id: string
        }
        Update: {
          consultation_request_id?: string
          expertise_domain_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_request_domains_consultation_request_id_fkey"
            columns: ["consultation_request_id"]
            isOneToOne: false
            referencedRelation: "consultation_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_request_domains_expertise_domain_id_fkey"
            columns: ["expertise_domain_id"]
            isOneToOne: false
            referencedRelation: "expertise_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_requests: {
        Row: {
          abstract: string | null
          closed_at: string | null
          complexity:
            | Database["public"]["Enums"]["consultation_complexity"]
            | null
          created_at: string
          id: string
          outcome_category:
            | Database["public"]["Enums"]["consultation_outcome"]
            | null
          outcome_summary: string | null
          priority: Database["public"]["Enums"]["consultation_priority"]
          project_deadline_on: string | null
          reference_no: string
          rejection_reason: string | null
          requester_user_id: string
          satisfaction_rating: number | null
          sla_breached: boolean
          sla_due_at: string | null
          status: Database["public"]["Enums"]["consultation_status"]
          supervisor_name: string | null
          support_type: Database["public"]["Enums"]["consultation_support_type"]
          title: string
          triaged_at: string | null
          triaged_by: string | null
          university_id: string | null
        }
        Insert: {
          abstract?: string | null
          closed_at?: string | null
          complexity?:
            | Database["public"]["Enums"]["consultation_complexity"]
            | null
          created_at?: string
          id?: string
          outcome_category?:
            | Database["public"]["Enums"]["consultation_outcome"]
            | null
          outcome_summary?: string | null
          priority?: Database["public"]["Enums"]["consultation_priority"]
          project_deadline_on?: string | null
          reference_no: string
          rejection_reason?: string | null
          requester_user_id: string
          satisfaction_rating?: number | null
          sla_breached?: boolean
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["consultation_status"]
          supervisor_name?: string | null
          support_type?: Database["public"]["Enums"]["consultation_support_type"]
          title: string
          triaged_at?: string | null
          triaged_by?: string | null
          university_id?: string | null
        }
        Update: {
          abstract?: string | null
          closed_at?: string | null
          complexity?:
            | Database["public"]["Enums"]["consultation_complexity"]
            | null
          created_at?: string
          id?: string
          outcome_category?:
            | Database["public"]["Enums"]["consultation_outcome"]
            | null
          outcome_summary?: string | null
          priority?: Database["public"]["Enums"]["consultation_priority"]
          project_deadline_on?: string | null
          reference_no?: string
          rejection_reason?: string | null
          requester_user_id?: string
          satisfaction_rating?: number | null
          sla_breached?: boolean
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["consultation_status"]
          supervisor_name?: string | null
          support_type?: Database["public"]["Enums"]["consultation_support_type"]
          title?: string
          triaged_at?: string | null
          triaged_by?: string | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_requests_requester_user_id_fkey"
            columns: ["requester_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_requests_triaged_by_fkey"
            columns: ["triaged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_requests_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      course_module_materials: {
        Row: {
          course_module_id: string
          id: string
          media_asset_id: string
          order_index: number
          title: string
          visibility: Database["public"]["Enums"]["material_visibility"]
        }
        Insert: {
          course_module_id: string
          id?: string
          media_asset_id: string
          order_index?: number
          title: string
          visibility?: Database["public"]["Enums"]["material_visibility"]
        }
        Update: {
          course_module_id?: string
          id?: string
          media_asset_id?: string
          order_index?: number
          title?: string
          visibility?: Database["public"]["Enums"]["material_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "course_module_materials_course_module_id_fkey"
            columns: ["course_module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_module_materials_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          estimated_minutes: number | null
          id: string
          objectives: string | null
          order_index: number
          title: string
          visibility: Database["public"]["Enums"]["module_visibility"]
        }
        Insert: {
          course_id: string
          estimated_minutes?: number | null
          id?: string
          objectives?: string | null
          order_index: number
          title: string
          visibility?: Database["public"]["Enums"]["module_visibility"]
        }
        Update: {
          course_id?: string
          estimated_minutes?: number | null
          id?: string
          objectives?: string | null
          order_index?: number
          title?: string
          visibility?: Database["public"]["Enums"]["module_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description_ar: string | null
          description_en: string | null
          duration_hours: number | null
          id: string
          kit_template_id: string | null
          language: string
          learning_outcomes: string | null
          level: Database["public"]["Enums"]["course_level"]
          prerequisites_text: string | null
          requires_screening: boolean
          session_count: number | null
          status: Database["public"]["Enums"]["course_status"]
          title_ar: string
          title_en: string
          track: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description_ar?: string | null
          description_en?: string | null
          duration_hours?: number | null
          id?: string
          kit_template_id?: string | null
          language?: string
          learning_outcomes?: string | null
          level: Database["public"]["Enums"]["course_level"]
          prerequisites_text?: string | null
          requires_screening?: boolean
          session_count?: number | null
          status?: Database["public"]["Enums"]["course_status"]
          title_ar: string
          title_en: string
          track: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description_ar?: string | null
          description_en?: string | null
          duration_hours?: number | null
          id?: string
          kit_template_id?: string | null
          language?: string
          learning_outcomes?: string | null
          level?: Database["public"]["Enums"]["course_level"]
          prerequisites_text?: string | null
          requires_screening?: boolean
          session_count?: number | null
          status?: Database["public"]["Enums"]["course_status"]
          title_ar?: string
          title_en?: string
          track?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_kit_template_id_fkey"
            columns: ["kit_template_id"]
            isOneToOne: false
            referencedRelation: "kit_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          id: string
          lead_user_id: string | null
          mandate: string | null
          name_ar: string
          name_en: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          lead_user_id?: string | null
          mandate?: string | null
          name_ar: string
          name_en: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          lead_user_id?: string | null
          mandate?: string | null
          name_ar?: string
          name_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_lead_user_id_fkey"
            columns: ["lead_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          application_id: string
          cohort_id: string
          completed_at: string | null
          completion_marked_by: string | null
          completion_overridden: boolean
          completion_override_reason: string | null
          enrolled_at: string
          id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          student_user_id: string
          updated_at: string
        }
        Insert: {
          application_id: string
          cohort_id: string
          completed_at?: string | null
          completion_marked_by?: string | null
          completion_overridden?: boolean
          completion_override_reason?: string | null
          enrolled_at?: string
          id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_user_id: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          cohort_id?: string
          completed_at?: string | null
          completion_marked_by?: string | null
          completion_overridden?: boolean
          completion_override_reason?: string | null
          enrolled_at?: string
          id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "v_cohort_funnel"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "enrollments_completion_marked_by_fkey"
            columns: ["completion_marked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          attendance_token: string
          attendee_user_id: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          event_id: string
          guest_email: string | null
          guest_name: string | null
          id: string
          is_walk_in: boolean
          registered_at: string
          state: Database["public"]["Enums"]["event_registration_state"]
          waitlist_rank: number | null
        }
        Insert: {
          attendance_token?: string
          attendee_user_id?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          event_id: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          is_walk_in?: boolean
          registered_at?: string
          state?: Database["public"]["Enums"]["event_registration_state"]
          waitlist_rank?: number | null
        }
        Update: {
          attendance_token?: string
          attendee_user_id?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          event_id?: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          is_walk_in?: boolean
          registered_at?: string
          state?: Database["public"]["Enums"]["event_registration_state"]
          waitlist_rank?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_attendee_user_id_fkey"
            columns: ["attendee_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_attendance_metrics"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_sessions: {
        Row: {
          ends_at: string
          event_id: string
          id: string
          room: string | null
          speaker_name: string | null
          speaker_user_id: string | null
          starts_at: string
          title: string
          track: string | null
        }
        Insert: {
          ends_at: string
          event_id: string
          id?: string
          room?: string | null
          speaker_name?: string | null
          speaker_user_id?: string | null
          starts_at: string
          title: string
          track?: string | null
        }
        Update: {
          ends_at?: string
          event_id?: string
          id?: string
          room?: string | null
          speaker_name?: string | null
          speaker_user_id?: string | null
          starts_at?: string
          title?: string
          track?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_attendance_metrics"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sessions_speaker_user_id_fkey"
            columns: ["speaker_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          cancel_reason: string | null
          cancellation_cutoff_at: string | null
          capacity: number | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          eligibility: Database["public"]["Enums"]["event_eligibility"]
          ends_at: string
          id: string
          organizing_department_id: string | null
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          registration_closes_at: string | null
          registration_opens_at: string | null
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          target_audience: string | null
          title_ar: string
          title_en: string
          type: Database["public"]["Enums"]["event_type"]
          venue_id: string | null
          waitlist_capacity: number
        }
        Insert: {
          cancel_reason?: string | null
          cancellation_cutoff_at?: string | null
          capacity?: number | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          eligibility?: Database["public"]["Enums"]["event_eligibility"]
          ends_at: string
          id?: string
          organizing_department_id?: string | null
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          target_audience?: string | null
          title_ar: string
          title_en: string
          type: Database["public"]["Enums"]["event_type"]
          venue_id?: string | null
          waitlist_capacity?: number
        }
        Update: {
          cancel_reason?: string | null
          cancellation_cutoff_at?: string | null
          capacity?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          eligibility?: Database["public"]["Enums"]["event_eligibility"]
          ends_at?: string
          id?: string
          organizing_department_id?: string | null
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          target_audience?: string | null
          title_ar?: string
          title_en?: string
          type?: Database["public"]["Enums"]["event_type"]
          venue_id?: string | null
          waitlist_capacity?: number
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organizing_department_id_fkey"
            columns: ["organizing_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
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
      expertise_domains: {
        Row: {
          code: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
        }
        Insert: {
          code: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
        }
        Update: {
          code?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
        }
        Relationships: []
      }
      galleries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          event_id: string | null
          id: string
          project_id: string | null
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          project_id?: string | null
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          project_id?: string | null
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "galleries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "galleries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "galleries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_attendance_metrics"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "galleries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_items: {
        Row: {
          caption: string | null
          gallery_id: string
          media_asset_id: string
          order_index: number
        }
        Insert: {
          caption?: string | null
          gallery_id: string
          media_asset_id: string
          order_index?: number
        }
        Update: {
          caption?: string | null
          gallery_id?: string
          media_asset_id?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "gallery_items_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_items_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_template_items: {
        Row: {
          asset_type_id: string
          kit_template_id: string
          quantity: number
        }
        Insert: {
          asset_type_id: string
          kit_template_id: string
          quantity: number
        }
        Update: {
          asset_type_id?: string
          kit_template_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "kit_template_items_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_template_items_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "v_asset_availability"
            referencedColumns: ["asset_type_id"]
          },
          {
            foreignKeyName: "kit_template_items_kit_template_id_fkey"
            columns: ["kit_template_id"]
            isOneToOne: false
            referencedRelation: "kit_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_templates: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      liability_records: {
        Row: {
          assessed_value: number | null
          checkout_line_id: string
          created_at: string
          currency: string
          enrollment_id: string | null
          holder_user_id: string
          id: string
          liability_type: Database["public"]["Enums"]["liability_type"]
          replacement_asset_unit_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["liability_status"]
          waived_by: string | null
          waiver_justification: string | null
        }
        Insert: {
          assessed_value?: number | null
          checkout_line_id: string
          created_at?: string
          currency?: string
          enrollment_id?: string | null
          holder_user_id: string
          id?: string
          liability_type: Database["public"]["Enums"]["liability_type"]
          replacement_asset_unit_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["liability_status"]
          waived_by?: string | null
          waiver_justification?: string | null
        }
        Update: {
          assessed_value?: number | null
          checkout_line_id?: string
          created_at?: string
          currency?: string
          enrollment_id?: string | null
          holder_user_id?: string
          id?: string
          liability_type?: Database["public"]["Enums"]["liability_type"]
          replacement_asset_unit_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["liability_status"]
          waived_by?: string | null
          waiver_justification?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "liability_records_checkout_line_id_fkey"
            columns: ["checkout_line_id"]
            isOneToOne: true
            referencedRelation: "checkout_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liability_records_checkout_line_id_fkey"
            columns: ["checkout_line_id"]
            isOneToOne: true
            referencedRelation: "v_enrollment_outstanding_items"
            referencedColumns: ["checkout_line_id"]
          },
          {
            foreignKeyName: "liability_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liability_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_attendance"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "liability_records_holder_user_id_fkey"
            columns: ["holder_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liability_records_replacement_asset_unit_id_fkey"
            columns: ["replacement_asset_unit_id"]
            isOneToOne: false
            referencedRelation: "asset_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liability_records_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liability_records_waived_by_fkey"
            columns: ["waived_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          byte_size: number
          caption: string | null
          captured_on: string | null
          content_hash: string | null
          created_at: string
          credit: string | null
          hash_algorithm: string
          height: number | null
          id: string
          mime_type: string
          storage_key: string
          uploaded_by: string | null
          usage_rights: Database["public"]["Enums"]["media_usage_rights"]
          width: number | null
        }
        Insert: {
          byte_size: number
          caption?: string | null
          captured_on?: string | null
          content_hash?: string | null
          created_at?: string
          credit?: string | null
          hash_algorithm?: string
          height?: number | null
          id?: string
          mime_type: string
          storage_key: string
          uploaded_by?: string | null
          usage_rights?: Database["public"]["Enums"]["media_usage_rights"]
          width?: number | null
        }
        Update: {
          byte_size?: number
          caption?: string | null
          captured_on?: string | null
          content_hash?: string | null
          created_at?: string
          credit?: string | null
          hash_algorithm?: string
          height?: number | null
          id?: string
          mime_type?: string
          storage_key?: string
          uploaded_by?: string | null
          usage_rights?: Database["public"]["Enums"]["media_usage_rights"]
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      member_expertise: {
        Row: {
          created_at: string
          curated_by: string | null
          evidence_project_id: string | null
          expertise_domain_id: string
          id: string
          is_available: boolean
          max_concurrent_load: number
          member_user_id: string
          proficiency: Database["public"]["Enums"]["expertise_proficiency"]
        }
        Insert: {
          created_at?: string
          curated_by?: string | null
          evidence_project_id?: string | null
          expertise_domain_id: string
          id?: string
          is_available?: boolean
          max_concurrent_load?: number
          member_user_id: string
          proficiency?: Database["public"]["Enums"]["expertise_proficiency"]
        }
        Update: {
          created_at?: string
          curated_by?: string | null
          evidence_project_id?: string | null
          expertise_domain_id?: string
          id?: string
          is_available?: boolean
          max_concurrent_load?: number
          member_user_id?: string
          proficiency?: Database["public"]["Enums"]["expertise_proficiency"]
        }
        Relationships: [
          {
            foreignKeyName: "member_expertise_curated_by_fkey"
            columns: ["curated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_expertise_evidence_project_id_fkey"
            columns: ["evidence_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_expertise_expertise_domain_id_fkey"
            columns: ["expertise_domain_id"]
            isOneToOne: false
            referencedRelation: "expertise_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_expertise_member_user_id_fkey"
            columns: ["member_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      member_profiles: {
        Row: {
          bio_ar: string | null
          bio_en: string | null
          joined_on: string | null
          membership_status: Database["public"]["Enums"]["membership_status"]
          primary_department_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio_ar?: string | null
          bio_en?: string | null
          joined_on?: string | null
          membership_status?: Database["public"]["Enums"]["membership_status"]
          primary_department_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio_ar?: string | null
          bio_en?: string | null
          joined_on?: string | null
          membership_status?: Database["public"]["Enums"]["membership_status"]
          primary_department_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_profiles_primary_department_id_fkey"
            columns: ["primary_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          code: string
          declared_variables: Json
          id: string
          locale: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          code: string
          declared_variables?: Json
          id?: string
          locale: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          code?: string
          declared_variables?: Json
          id?: string
          locale?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          recipient_user_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          template_id: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          recipient_user_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template_id?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          recipient_user_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: Database["public"]["Enums"]["permission_action"]
          code: string
          description: string | null
          id: string
          module: string
        }
        Insert: {
          action: Database["public"]["Enums"]["permission_action"]
          code: string
          description?: string | null
          id?: string
          module: string
        }
        Update: {
          action?: Database["public"]["Enums"]["permission_action"]
          code?: string
          description?: string | null
          id?: string
          module?: string
        }
        Relationships: []
      }
      project_bom_lines: {
        Row: {
          asset_type_id: string
          id: string
          note: string | null
          project_id: string
          quantity: number
        }
        Insert: {
          asset_type_id: string
          id?: string
          note?: string | null
          project_id: string
          quantity: number
        }
        Update: {
          asset_type_id?: string
          id?: string
          note?: string | null
          project_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_bom_lines_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_bom_lines_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "v_asset_availability"
            referencedColumns: ["asset_type_id"]
          },
          {
            foreignKeyName: "project_bom_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_media: {
        Row: {
          caption: string | null
          media_asset_id: string
          order_index: number
          project_id: string
          visibility: Database["public"]["Enums"]["project_media_visibility"]
        }
        Insert: {
          caption?: string | null
          media_asset_id: string
          order_index?: number
          project_id: string
          visibility?: Database["public"]["Enums"]["project_media_visibility"]
        }
        Update: {
          caption?: string | null
          media_asset_id?: string
          order_index?: number
          project_id?: string
          visibility?: Database["public"]["Enums"]["project_media_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "project_media_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_media_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          contribution_note: string | null
          project_id: string
          role_in_project: Database["public"]["Enums"]["project_member_role"]
          user_id: string
        }
        Insert: {
          contribution_note?: string | null
          project_id: string
          role_in_project: Database["public"]["Enums"]["project_member_role"]
          user_id: string
        }
        Update: {
          contribution_note?: string | null
          project_id?: string
          role_in_project?: Database["public"]["Enums"]["project_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_technologies: {
        Row: {
          project_id: string
          technology_id: string
        }
        Insert: {
          project_id: string
          technology_id: string
        }
        Update: {
          project_id?: string
          technology_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_technologies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_technologies_technology_id_fkey"
            columns: ["technology_id"]
            isOneToOne: false
            referencedRelation: "technologies"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          abstract: string | null
          code: string
          cover_media_id: string | null
          created_at: string
          created_by: string | null
          end_on: string | null
          id: string
          outcome: string | null
          problem_statement: string | null
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          published_by: string | null
          scheduled_publish_at: string | null
          start_on: string | null
          status: Database["public"]["Enums"]["project_status"]
          title_ar: string
          title_en: string
        }
        Insert: {
          abstract?: string | null
          code: string
          cover_media_id?: string | null
          created_at?: string
          created_by?: string | null
          end_on?: string | null
          id?: string
          outcome?: string | null
          problem_statement?: string | null
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          scheduled_publish_at?: string | null
          start_on?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title_ar: string
          title_en: string
        }
        Update: {
          abstract?: string | null
          code?: string
          cover_media_id?: string | null
          created_at?: string
          created_by?: string | null
          end_on?: string | null
          id?: string
          outcome?: string | null
          problem_statement?: string | null
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          scheduled_publish_at?: string | null
          start_on?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title_ar?: string
          title_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      question_options: {
        Row: {
          id: string
          is_correct: boolean
          option_text: string
          order_index: number
          question_id: string
        }
        Insert: {
          id?: string
          is_correct?: boolean
          option_text: string
          order_index: number
          question_id: string
        }
        Update: {
          id?: string
          is_correct?: boolean
          option_text?: string
          order_index?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_topics: {
        Row: {
          question_id: string
          topic_id: string
        }
        Insert: {
          question_id: string
          topic_id: string
        }
        Update: {
          question_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_topics_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          auto_gradable: boolean
          created_at: string
          created_by: string | null
          difficulty: Database["public"]["Enums"]["question_difficulty"]
          grading_rubric: string | null
          id: string
          is_current: boolean
          max_score: number
          root_question_id: string | null
          stem: string
          type: Database["public"]["Enums"]["question_type"]
          version: number
        }
        Insert: {
          auto_gradable?: boolean
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          grading_rubric?: string | null
          id?: string
          is_current?: boolean
          max_score: number
          root_question_id?: string | null
          stem: string
          type: Database["public"]["Enums"]["question_type"]
          version?: number
        }
        Update: {
          auto_gradable?: boolean
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          grading_rubric?: string | null
          id?: string
          is_current?: boolean
          max_score?: number
          root_question_id?: string | null
          stem?: string
          type?: Database["public"]["Enums"]["question_type"]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_root_question_id_fkey"
            columns: ["root_question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      readiness_factors: {
        Row: {
          factor_code: string
          id: string
          readiness_model_id: string
          value_source: Database["public"]["Enums"]["readiness_value_source"]
          weight_pct: number
        }
        Insert: {
          factor_code: string
          id?: string
          readiness_model_id: string
          value_source: Database["public"]["Enums"]["readiness_value_source"]
          weight_pct: number
        }
        Update: {
          factor_code?: string
          id?: string
          readiness_model_id?: string
          value_source?: Database["public"]["Enums"]["readiness_value_source"]
          weight_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "readiness_factors_readiness_model_id_fkey"
            columns: ["readiness_model_id"]
            isOneToOne: false
            referencedRelation: "readiness_models"
            referencedColumns: ["id"]
          },
        ]
      }
      readiness_models: {
        Row: {
          cohort_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "readiness_models_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readiness_models_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "v_cohort_funnel"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "readiness_models_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rejection_reasons: {
        Row: {
          code: string
          id: string
          is_active: boolean
          text_ar: string
          text_en: string
        }
        Insert: {
          code: string
          id?: string
          is_active?: boolean
          text_ar: string
          text_en: string
        }
        Update: {
          code?: string
          id?: string
          is_active?: boolean
          text_ar?: string
          text_en?: string
        }
        Relationships: []
      }
      requisition_lines: {
        Row: {
          asset_type_id: string
          id: string
          quantity_approved: number
          quantity_requested: number
          requisition_id: string
        }
        Insert: {
          asset_type_id: string
          id?: string
          quantity_approved?: number
          quantity_requested: number
          requisition_id: string
        }
        Update: {
          asset_type_id?: string
          id?: string
          quantity_approved?: number
          quantity_requested?: number
          requisition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisition_lines_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisition_lines_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "v_asset_availability"
            referencedColumns: ["asset_type_id"]
          },
          {
            foreignKeyName: "requisition_lines_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      requisitions: {
        Row: {
          cohort_id: string | null
          created_at: string
          event_id: string | null
          id: string
          project_id: string | null
          purpose_type: Database["public"]["Enums"]["requisition_purpose_type"]
          requester_user_id: string
          required_by: string | null
          requisition_no: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["requisition_status"]
        }
        Insert: {
          cohort_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          project_id?: string | null
          purpose_type: Database["public"]["Enums"]["requisition_purpose_type"]
          requester_user_id: string
          required_by?: string | null
          requisition_no: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["requisition_status"]
        }
        Update: {
          cohort_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          project_id?: string | null
          purpose_type?: Database["public"]["Enums"]["requisition_purpose_type"]
          requester_user_id?: string
          required_by?: string | null
          requisition_no?: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["requisition_status"]
        }
        Relationships: [
          {
            foreignKeyName: "requisitions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "v_cohort_funnel"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "requisitions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_attendance_metrics"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "requisitions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_requester_user_id_fkey"
            columns: ["requester_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          permission_id: string
          role_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          permission_id: string
          role_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name_ar: string
          name_en: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name_ar: string
          name_en: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name_ar?: string
          name_en?: string
        }
        Relationships: []
      }
      screening_tests: {
        Row: {
          attempt_limit: number
          cohort_id: string
          created_at: string
          created_by: string | null
          duration_minutes: number
          id: string
          max_score: number
          pass_threshold: number
          result_visibility: Database["public"]["Enums"]["test_result_visibility"]
          shuffle_options: boolean
          shuffle_questions: boolean
          status: Database["public"]["Enums"]["screening_test_status"]
          title: string
          version: number
        }
        Insert: {
          attempt_limit?: number
          cohort_id: string
          created_at?: string
          created_by?: string | null
          duration_minutes: number
          id?: string
          max_score: number
          pass_threshold: number
          result_visibility?: Database["public"]["Enums"]["test_result_visibility"]
          shuffle_options?: boolean
          shuffle_questions?: boolean
          status?: Database["public"]["Enums"]["screening_test_status"]
          title: string
          version?: number
        }
        Update: {
          attempt_limit?: number
          cohort_id?: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          max_score?: number
          pass_threshold?: number
          result_visibility?: Database["public"]["Enums"]["test_result_visibility"]
          shuffle_options?: boolean
          shuffle_questions?: boolean
          status?: Database["public"]["Enums"]["screening_test_status"]
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "screening_tests_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: true
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_tests_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: true
            referencedRelation: "v_cohort_funnel"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "screening_tests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          asset_type_id: string
          created_at: string
          expires_at: string
          id: string
          quantity: number
          requisition_line_id: string
          status: Database["public"]["Enums"]["stock_reservation_status"]
          storage_location_id: string
        }
        Insert: {
          asset_type_id: string
          created_at?: string
          expires_at: string
          id?: string
          quantity: number
          requisition_line_id: string
          status?: Database["public"]["Enums"]["stock_reservation_status"]
          storage_location_id: string
        }
        Update: {
          asset_type_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          quantity?: number
          requisition_line_id?: string
          status?: Database["public"]["Enums"]["stock_reservation_status"]
          storage_location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "v_asset_availability"
            referencedColumns: ["asset_type_id"]
          },
          {
            foreignKeyName: "stock_reservations_requisition_line_id_fkey"
            columns: ["requisition_line_id"]
            isOneToOne: false
            referencedRelation: "requisition_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_storage_location_id_fkey"
            columns: ["storage_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_locations: {
        Row: {
          code: string
          description: string | null
          id: string
          name: string
          parent_location_id: string | null
        }
        Insert: {
          code: string
          description?: string | null
          id?: string
          name: string
          parent_location_id?: string | null
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
          name?: string
          parent_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storage_locations_parent_location_id_fkey"
            columns: ["parent_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          academic_year: number | null
          department_name: string | null
          faculty: string | null
          student_number: string | null
          university_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year?: number | null
          department_name?: string | null
          faculty?: string | null
          student_number?: string | null
          university_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year?: number | null
          department_name?: string | null
          faculty?: string | null
          student_number?: string | null
          university_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_policies: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_policies_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      technologies: {
        Row: {
          category: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      test_attempts: {
        Row: {
          application_id: string
          attempt_no: number
          auto_submitted: boolean
          deadline_at: string
          id: string
          normalized_score: number | null
          raw_score: number | null
          screening_test_id: string
          started_at: string
          state: Database["public"]["Enums"]["test_attempt_state"]
          submitted_at: string | null
        }
        Insert: {
          application_id: string
          attempt_no: number
          auto_submitted?: boolean
          deadline_at: string
          id?: string
          normalized_score?: number | null
          raw_score?: number | null
          screening_test_id: string
          started_at?: string
          state?: Database["public"]["Enums"]["test_attempt_state"]
          submitted_at?: string | null
        }
        Update: {
          application_id?: string
          attempt_no?: number
          auto_submitted?: boolean
          deadline_at?: string
          id?: string
          normalized_score?: number | null
          raw_score?: number | null
          screening_test_id?: string
          started_at?: string
          state?: Database["public"]["Enums"]["test_attempt_state"]
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_attempts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_attempts_screening_test_id_fkey"
            columns: ["screening_test_id"]
            isOneToOne: false
            referencedRelation: "screening_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_questions: {
        Row: {
          order_index: number
          question_id: string
          question_version: number
          screening_test_id: string
          weight: number
        }
        Insert: {
          order_index?: number
          question_id: string
          question_version: number
          screening_test_id: string
          weight: number
        }
        Update: {
          order_index?: number
          question_id?: string
          question_version?: number
          screening_test_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "test_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_questions_screening_test_id_fkey"
            columns: ["screening_test_id"]
            isOneToOne: false
            referencedRelation: "screening_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          code: string
          id: string
          name_ar: string
          name_en: string
        }
        Insert: {
          code: string
          id?: string
          name_ar: string
          name_en: string
        }
        Update: {
          code?: string
          id?: string
          name_ar?: string
          name_en?: string
        }
        Relationships: []
      }
      universities: {
        Row: {
          country_code: string
          created_at: string
          id: string
          name_ar: string
          name_en: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          id?: string
          name_ar: string
          name_en: string
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          department_id: string | null
          expires_at: string | null
          id: string
          revoked_at: string | null
          revoked_by: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          department_id?: string | null
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          department_id?: string | null
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          email_verified_at: string | null
          full_name_ar: string
          full_name_en: string
          id: string
          last_login_at: string | null
          locale: string
          phone: string | null
          status: Database["public"]["Enums"]["user_status"]
          token_epoch: number
          updated_at: string
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          created_at?: string
          email: string
          email_verified_at?: string | null
          full_name_ar: string
          full_name_en: string
          id: string
          last_login_at?: string | null
          locale?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          token_epoch?: number
          updated_at?: string
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          created_at?: string
          email?: string
          email_verified_at?: string | null
          full_name_ar?: string
          full_name_en?: string
          id?: string
          last_login_at?: string | null
          locale?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          token_epoch?: number
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: []
      }
      venues: {
        Row: {
          capacity: number | null
          id: string
          location_note: string | null
          name: string
        }
        Insert: {
          capacity?: number | null
          id?: string
          location_note?: string | null
          name: string
        }
        Update: {
          capacity?: number | null
          id?: string
          location_note?: string | null
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_asset_availability: {
        Row: {
          asset_type_id: string | null
          bulk_available: number | null
          name: string | null
          serialized_available: number | null
          tracking_mode:
            | Database["public"]["Enums"]["asset_tracking_mode"]
            | null
        }
        Relationships: []
      }
      v_cohort_funnel: {
        Row: {
          capacity: number | null
          cohort_id: string | null
          enrolled: number | null
          expired: number | null
          offered: number | null
          rejected: number | null
          total_applications: number | null
          waitlisted: number | null
        }
        Relationships: []
      }
      v_enrollment_attendance: {
        Row: {
          attendance_pct: number | null
          cohort_id: string | null
          enrollment_id: string | null
          sessions_attended: number | null
          sessions_held: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "v_cohort_funnel"
            referencedColumns: ["cohort_id"]
          },
        ]
      }
      v_enrollment_outstanding_items: {
        Row: {
          asset_name: string | null
          checkout_line_id: string | null
          enrollment_id: string | null
          is_consumable: boolean | null
          line_status:
            | Database["public"]["Enums"]["checkout_line_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "checkouts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_attendance"
            referencedColumns: ["enrollment_id"]
          },
        ]
      }
      v_event_attendance_metrics: {
        Row: {
          attendance_rate_pct: number | null
          attended_count: number | null
          event_id: string | null
          no_show_count: number | null
          registered_count: number | null
          waitlisted_count: number | null
        }
        Relationships: []
      }
      v_expert_current_load: {
        Row: {
          current_load: number | null
          max_concurrent_load: number | null
          member_user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_expertise_member_user_id_fkey"
            columns: ["member_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      v_holder_open_liabilities: {
        Row: {
          holder_user_id: string | null
          liability_ids: string[] | null
          open_assessed_value: number | null
          open_liability_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "liability_records_holder_user_id_fkey"
            columns: ["holder_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_clearance: {
        Args: { p_enrollment_id: string; p_override_justification?: string }
        Returns: Json
      }
      approve_requisition: {
        Args: {
          p_line_approvals?: Json
          p_note?: string
          p_requisition_id: string
        }
        Returns: Json
      }
      attach_certificate_document: {
        Args: {
          p_byte_size: number
          p_certificate_id: string
          p_content_hash: string
          p_mime_type?: string
          p_storage_key: string
        }
        Returns: string
      }
      check_in_line: {
        Args: {
          p_assessed_value?: number
          p_condition_at_return: Database["public"]["Enums"]["asset_condition"]
          p_evidence_media_id?: string
          p_inspection_notes?: string
          p_line_id: string
        }
        Returns: Json
      }
      clone_question_as_new_version: {
        Args: { p_question_id: string }
        Returns: string
      }
      compute_readiness_for_cohort: {
        Args: { p_cohort_id: string }
        Returns: Json
      }
      compute_readiness_score: {
        Args: { p_application_id: string }
        Returns: number
      }
      evaluate_clearance: { Args: { p_enrollment_id: string }; Returns: Json }
      evaluate_completion_readiness: {
        Args: { p_enrollment_id: string }
        Returns: Json
      }
      expire_stale_offers: { Args: never; Returns: Json }
      finalize_attempt_grading: {
        Args: { p_attempt_id: string }
        Returns: Json
      }
      get_attempt_paper: {
        Args: { p_attempt_id: string }
        Returns: {
          options: Json
          order_index: number
          qtype: Database["public"]["Enums"]["question_type"]
          question_id: string
          saved_option_id: string
          saved_payload: Json
          stem: string
          weight: number
        }[]
      }
      grade_attempt_answer: {
        Args: {
          p_answer_id: string
          p_awarded_score: number
          p_comment?: string
        }
        Returns: undefined
      }
      has_permission: { Args: { p_code: string }; Returns: boolean }
      issue_certificate: { Args: { p_enrollment_id: string }; Returns: Json }
      issue_checkout: {
        Args: {
          p_custody_type: Database["public"]["Enums"]["custody_type"]
          p_due_at: string
          p_enrollment_id?: string
          p_holder_user_id: string
          p_lines: Json
          p_override_justification?: string
          p_requisition_id?: string
        }
        Returns: string
      }
      mark_enrollment_completed: {
        Args: {
          p_enrollment_id: string
          p_evaluations_passed: boolean
          p_override_reason?: string
        }
        Returns: Json
      }
      raise_requisition: {
        Args: {
          p_cohort_id?: string
          p_event_id?: string
          p_lines: Json
          p_project_id?: string
          p_purpose_type: Database["public"]["Enums"]["requisition_purpose_type"]
          p_required_by: string
        }
        Returns: string
      }
      record_attendance: {
        Args: {
          p_amendment_reason?: string
          p_cohort_session_id: string
          p_enrollment_id: string
          p_note?: string
          p_state: Database["public"]["Enums"]["attendance_state"]
        }
        Returns: undefined
      }
      reject_requisition: {
        Args: { p_reason: string; p_requisition_id: string }
        Returns: undefined
      }
      release_expired_reservations: { Args: never; Returns: Json }
      resolve_liability: {
        Args: {
          p_liability_id: string
          p_note?: string
          p_replacement_asset_unit_id?: string
          p_status: Database["public"]["Enums"]["liability_status"]
        }
        Returns: undefined
      }
      respond_to_offer: {
        Args: { p_accept: boolean; p_application_id: string }
        Returns: string
      }
      run_seat_allocation: { Args: { p_cohort_id: string }; Returns: Json }
      save_attempt_answer: {
        Args: {
          p_answer_payload?: Json
          p_attempt_id: string
          p_question_id: string
          p_selected_option_id?: string
        }
        Returns: undefined
      }
      start_test_attempt: {
        Args: { p_application_id: string }
        Returns: string
      }
      submit_application: {
        Args: { p_background?: Json; p_cohort_id: string }
        Returns: string
      }
      submit_test_attempt: { Args: { p_attempt_id: string }; Returns: Json }
      verify_certificate: {
        Args: { p_code: string }
        Returns: {
          cert_status: Database["public"]["Enums"]["certificate_status"]
          cohort_code: string
          course_level: Database["public"]["Enums"]["course_level"]
          course_title_ar: string
          course_title_en: string
          issued_at: string
          revoked_at: string
          serial_no: string
          student_name_ar: string
          student_name_en: string
        }[]
      }
      withdraw_application: {
        Args: { p_application_id: string }
        Returns: string
      }
    }
    Enums: {
      application_status:
        | "SUBMITTED"
        | "AWAITING_SCREENING"
        | "UNDER_EVALUATION"
        | "OFFERED"
        | "WAITLISTED"
        | "ENROLLED"
        | "REJECTED"
        | "DECLINED"
        | "EXPIRED"
        | "WITHDRAWN"
      asset_condition: "HEALTHY" | "DAMAGED" | "LOST"
      asset_incident_status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED"
      asset_tracking_mode: "SERIALIZED" | "BULK"
      asset_unit_of_measure: "PIECE" | "METER" | "GRAM" | "SET"
      asset_unit_status:
        | "AVAILABLE"
        | "RESERVED"
        | "CHECKED_OUT"
        | "UNDER_REPAIR"
        | "LOST"
        | "RETIRED"
        | "WRITTEN_OFF"
      attendance_state: "PRESENT" | "ABSENT" | "EXCUSED" | "LATE"
      award_level: "LOCAL" | "NATIONAL" | "INTERNATIONAL"
      certificate_status: "ISSUED" | "REVOKED" | "REISSUED"
      checkout_line_condition: "HEALTHY" | "DAMAGED"
      checkout_line_status:
        | "ACTIVE"
        | "OVERDUE"
        | "RETURNED"
        | "RETURNED_DAMAGED"
        | "LOST"
      checkout_status: "ACTIVE" | "PARTIALLY_RETURNED" | "CLOSED"
      clearance_blocker_code:
        | "NOT_COMPLETED"
        | "ITEMS_OUTSTANDING"
        | "INSPECTION_PENDING"
        | "LIABILITY_OPEN"
        | "INCIDENT_OPEN"
      clearance_status:
        | "EVALUATING"
        | "WITHHELD"
        | "APPROVED"
        | "APPROVED_BY_OVERRIDE"
        | "REVOKED"
      cohort_session_status: "PLANNED" | "HELD" | "CANCELLED"
      cohort_status:
        | "DRAFT"
        | "OPEN"
        | "CLOSED"
        | "RUNNING"
        | "FINISHED"
        | "CANCELLED"
      consultation_assignment_state:
        | "PENDING_ACCEPTANCE"
        | "ACCEPTED"
        | "DECLINED"
        | "NO_RESPONSE"
        | "RELEASED"
      consultation_complexity: "LOW" | "MEDIUM" | "HIGH"
      consultation_outcome:
        | "ADVICE_GIVEN"
        | "ONGOING_MENTORSHIP"
        | "OUT_OF_SCOPE"
        | "UNRESPONSIVE"
      consultation_priority: "LOW" | "NORMAL" | "HIGH"
      consultation_status:
        | "NEW"
        | "TRIAGED"
        | "ASSIGNED"
        | "IN_PROGRESS"
        | "RESOLVED"
        | "REJECTED"
        | "ESCALATED"
      consultation_support_type:
        | "TECHNICAL_ADVICE"
        | "COMPONENT_SELECTION"
        | "CODE_REVIEW"
        | "MENTORSHIP"
        | "OTHER"
      course_level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
      course_status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
      custody_type: "STUDENT" | "PROJECT_TEAM" | "EVENT_LEAD"
      enrollment_status:
        | "ACTIVE"
        | "COMPLETED"
        | "COMPLETED_BY_OVERRIDE"
        | "NOT_COMPLETED"
        | "WITHDRAWN"
        | "CERTIFIED"
        | "CERTIFICATE_REVOKED"
      event_eligibility: "PUBLIC" | "REGISTERED_STUDENTS" | "MEMBERS_ONLY"
      event_registration_state:
        | "REGISTERED"
        | "WAITLISTED"
        | "CANCELLED"
        | "ATTENDED"
        | "NO_SHOW"
      event_status:
        | "PLANNED"
        | "RUNNING"
        | "FINISHED"
        | "CANCELLED"
        | "POSTPONED"
      event_type: "WORKSHOP" | "EXHIBITION" | "HACKATHON" | "SEMINAR"
      expertise_proficiency: "FAMILIAR" | "PROFICIENT" | "EXPERT"
      liability_status:
        | "OPEN"
        | "UNDER_ASSESSMENT"
        | "PENDING_SETTLEMENT"
        | "RESOLVED_REPAIRED"
        | "RESOLVED_REPLACED"
        | "RESOLVED_SETTLED"
        | "RESOLVED_WAIVED"
      liability_type: "DAMAGE" | "LOSS"
      material_visibility: "ENROLLED" | "INTERNAL"
      media_usage_rights:
        | "CLUB_OWNED"
        | "LICENSED"
        | "PUBLIC_DOMAIN"
        | "RESTRICTED"
      membership_status: "ACTIVE" | "ON_LEAVE" | "ALUMNI"
      module_visibility: "PUBLIC" | "ENROLLED" | "INTERNAL"
      notification_channel: "EMAIL" | "IN_APP"
      notification_status: "QUEUED" | "SENT" | "FAILED"
      permission_action:
        | "CREATE"
        | "READ"
        | "UPDATE"
        | "DELETE"
        | "APPROVE"
        | "OVERRIDE"
        | "EXPORT"
      project_media_visibility: "PUBLIC" | "INTERNAL"
      project_member_role:
        | "LEAD"
        | "HARDWARE"
        | "FIRMWARE"
        | "MECHANICAL"
        | "ML"
        | "DOCUMENTATION"
      project_status: "IDEA" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED"
      publication_status:
        | "DRAFT"
        | "PENDING_REVIEW"
        | "SCHEDULED"
        | "PUBLISHED"
        | "REJECTED"
      question_difficulty: "EASY" | "MEDIUM" | "HARD"
      question_type:
        | "SINGLE_CHOICE"
        | "MULTI_CHOICE"
        | "TRUE_FALSE"
        | "NUMERIC"
        | "SHORT_ANSWER"
        | "CODE"
      readiness_value_source: "TEST" | "DECLARED" | "MANUAL"
      requisition_purpose_type: "COHORT" | "PROJECT" | "EVENT"
      requisition_status:
        | "PENDING"
        | "APPROVED"
        | "PARTIALLY_APPROVED"
        | "REJECTED"
        | "FULFILLED"
        | "CANCELLED"
      screening_test_status: "DRAFT" | "ACTIVE" | "LOCKED" | "ARCHIVED"
      stock_reservation_status: "ACTIVE" | "CONSUMED" | "EXPIRED" | "RELEASED"
      test_attempt_state:
        | "IN_PROGRESS"
        | "SUBMITTED"
        | "GRADING"
        | "GRADED"
        | "VOIDED"
      test_result_visibility:
        | "HIDDEN"
        | "SCORE_ONLY"
        | "SCORE_AND_FEEDBACK"
        | "FULL"
      user_status:
        | "PENDING_VERIFICATION"
        | "ACTIVE"
        | "SUSPENDED"
        | "DEACTIVATED"
      user_type: "EXTERNAL_STUDENT" | "MEMBER"
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
      application_status: [
        "SUBMITTED",
        "AWAITING_SCREENING",
        "UNDER_EVALUATION",
        "OFFERED",
        "WAITLISTED",
        "ENROLLED",
        "REJECTED",
        "DECLINED",
        "EXPIRED",
        "WITHDRAWN",
      ],
      asset_condition: ["HEALTHY", "DAMAGED", "LOST"],
      asset_incident_status: ["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"],
      asset_tracking_mode: ["SERIALIZED", "BULK"],
      asset_unit_of_measure: ["PIECE", "METER", "GRAM", "SET"],
      asset_unit_status: [
        "AVAILABLE",
        "RESERVED",
        "CHECKED_OUT",
        "UNDER_REPAIR",
        "LOST",
        "RETIRED",
        "WRITTEN_OFF",
      ],
      attendance_state: ["PRESENT", "ABSENT", "EXCUSED", "LATE"],
      award_level: ["LOCAL", "NATIONAL", "INTERNATIONAL"],
      certificate_status: ["ISSUED", "REVOKED", "REISSUED"],
      checkout_line_condition: ["HEALTHY", "DAMAGED"],
      checkout_line_status: [
        "ACTIVE",
        "OVERDUE",
        "RETURNED",
        "RETURNED_DAMAGED",
        "LOST",
      ],
      checkout_status: ["ACTIVE", "PARTIALLY_RETURNED", "CLOSED"],
      clearance_blocker_code: [
        "NOT_COMPLETED",
        "ITEMS_OUTSTANDING",
        "INSPECTION_PENDING",
        "LIABILITY_OPEN",
        "INCIDENT_OPEN",
      ],
      clearance_status: [
        "EVALUATING",
        "WITHHELD",
        "APPROVED",
        "APPROVED_BY_OVERRIDE",
        "REVOKED",
      ],
      cohort_session_status: ["PLANNED", "HELD", "CANCELLED"],
      cohort_status: [
        "DRAFT",
        "OPEN",
        "CLOSED",
        "RUNNING",
        "FINISHED",
        "CANCELLED",
      ],
      consultation_assignment_state: [
        "PENDING_ACCEPTANCE",
        "ACCEPTED",
        "DECLINED",
        "NO_RESPONSE",
        "RELEASED",
      ],
      consultation_complexity: ["LOW", "MEDIUM", "HIGH"],
      consultation_outcome: [
        "ADVICE_GIVEN",
        "ONGOING_MENTORSHIP",
        "OUT_OF_SCOPE",
        "UNRESPONSIVE",
      ],
      consultation_priority: ["LOW", "NORMAL", "HIGH"],
      consultation_status: [
        "NEW",
        "TRIAGED",
        "ASSIGNED",
        "IN_PROGRESS",
        "RESOLVED",
        "REJECTED",
        "ESCALATED",
      ],
      consultation_support_type: [
        "TECHNICAL_ADVICE",
        "COMPONENT_SELECTION",
        "CODE_REVIEW",
        "MENTORSHIP",
        "OTHER",
      ],
      course_level: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
      course_status: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      custody_type: ["STUDENT", "PROJECT_TEAM", "EVENT_LEAD"],
      enrollment_status: [
        "ACTIVE",
        "COMPLETED",
        "COMPLETED_BY_OVERRIDE",
        "NOT_COMPLETED",
        "WITHDRAWN",
        "CERTIFIED",
        "CERTIFICATE_REVOKED",
      ],
      event_eligibility: ["PUBLIC", "REGISTERED_STUDENTS", "MEMBERS_ONLY"],
      event_registration_state: [
        "REGISTERED",
        "WAITLISTED",
        "CANCELLED",
        "ATTENDED",
        "NO_SHOW",
      ],
      event_status: [
        "PLANNED",
        "RUNNING",
        "FINISHED",
        "CANCELLED",
        "POSTPONED",
      ],
      event_type: ["WORKSHOP", "EXHIBITION", "HACKATHON", "SEMINAR"],
      expertise_proficiency: ["FAMILIAR", "PROFICIENT", "EXPERT"],
      liability_status: [
        "OPEN",
        "UNDER_ASSESSMENT",
        "PENDING_SETTLEMENT",
        "RESOLVED_REPAIRED",
        "RESOLVED_REPLACED",
        "RESOLVED_SETTLED",
        "RESOLVED_WAIVED",
      ],
      liability_type: ["DAMAGE", "LOSS"],
      material_visibility: ["ENROLLED", "INTERNAL"],
      media_usage_rights: [
        "CLUB_OWNED",
        "LICENSED",
        "PUBLIC_DOMAIN",
        "RESTRICTED",
      ],
      membership_status: ["ACTIVE", "ON_LEAVE", "ALUMNI"],
      module_visibility: ["PUBLIC", "ENROLLED", "INTERNAL"],
      notification_channel: ["EMAIL", "IN_APP"],
      notification_status: ["QUEUED", "SENT", "FAILED"],
      permission_action: [
        "CREATE",
        "READ",
        "UPDATE",
        "DELETE",
        "APPROVE",
        "OVERRIDE",
        "EXPORT",
      ],
      project_media_visibility: ["PUBLIC", "INTERNAL"],
      project_member_role: [
        "LEAD",
        "HARDWARE",
        "FIRMWARE",
        "MECHANICAL",
        "ML",
        "DOCUMENTATION",
      ],
      project_status: ["IDEA", "IN_PROGRESS", "COMPLETED", "ARCHIVED"],
      publication_status: [
        "DRAFT",
        "PENDING_REVIEW",
        "SCHEDULED",
        "PUBLISHED",
        "REJECTED",
      ],
      question_difficulty: ["EASY", "MEDIUM", "HARD"],
      question_type: [
        "SINGLE_CHOICE",
        "MULTI_CHOICE",
        "TRUE_FALSE",
        "NUMERIC",
        "SHORT_ANSWER",
        "CODE",
      ],
      readiness_value_source: ["TEST", "DECLARED", "MANUAL"],
      requisition_purpose_type: ["COHORT", "PROJECT", "EVENT"],
      requisition_status: [
        "PENDING",
        "APPROVED",
        "PARTIALLY_APPROVED",
        "REJECTED",
        "FULFILLED",
        "CANCELLED",
      ],
      screening_test_status: ["DRAFT", "ACTIVE", "LOCKED", "ARCHIVED"],
      stock_reservation_status: ["ACTIVE", "CONSUMED", "EXPIRED", "RELEASED"],
      test_attempt_state: [
        "IN_PROGRESS",
        "SUBMITTED",
        "GRADING",
        "GRADED",
        "VOIDED",
      ],
      test_result_visibility: [
        "HIDDEN",
        "SCORE_ONLY",
        "SCORE_AND_FEEDBACK",
        "FULL",
      ],
      user_status: [
        "PENDING_VERIFICATION",
        "ACTIVE",
        "SUSPENDED",
        "DEACTIVATED",
      ],
      user_type: ["EXTERNAL_STUDENT", "MEMBER"],
    },
  },
} as const
