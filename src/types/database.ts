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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: number
          ip_address: unknown
          metadata: Json
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          ip_address?: unknown
          metadata?: Json
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          ip_address?: unknown
          metadata?: Json
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          capability: string
          completion_tokens: number
          cost_usd: number
          created_at: string
          credits_charged: number
          error_code: string | null
          id: number
          latency_ms: number | null
          model: string
          prompt_tokens: number
          provider: string
          resume_id: string | null
          success: boolean
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          capability: string
          completion_tokens?: number
          cost_usd?: number
          created_at?: string
          credits_charged?: number
          error_code?: string | null
          id?: never
          latency_ms?: number | null
          model: string
          prompt_tokens?: number
          provider: string
          resume_id?: string | null
          success?: boolean
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          capability?: string
          completion_tokens?: number
          cost_usd?: number
          created_at?: string
          credits_charged?: number
          error_code?: string | null
          id?: never
          latency_ms?: number | null
          model?: string
          prompt_tokens?: number
          provider?: string
          resume_id?: string | null
          success?: boolean
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      awards: {
        Row: {
          awarded_on: string | null
          id: string
          issuer: string | null
          item_key: string | null
          resume_id: string
          sort_order: number
          summary: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          awarded_on?: string | null
          id?: string
          issuer?: string | null
          item_key?: string | null
          resume_id: string
          sort_order?: number
          summary?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          awarded_on?: string | null
          id?: string
          issuer?: string | null
          item_key?: string | null
          resume_id?: string
          sort_order?: number
          summary?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "awards_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          credential_id: string | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuer: string | null
          item_key: string | null
          name: string | null
          resume_id: string
          sort_order: number
          url: string | null
          user_id: string
        }
        Insert: {
          credential_id?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          item_key?: string | null
          name?: string | null
          resume_id: string
          sort_order?: number
          url?: string | null
          user_id: string
        }
        Update: {
          credential_id?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          item_key?: string | null
          name?: string | null
          resume_id?: string
          sort_order?: number
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      education: {
        Row: {
          area: string | null
          degree: string | null
          end_date: string | null
          grade: string | null
          highlights: string[]
          id: string
          institution: string | null
          is_current: boolean
          item_key: string | null
          location: string | null
          resume_id: string
          sort_order: number
          start_date: string | null
          summary: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          area?: string | null
          degree?: string | null
          end_date?: string | null
          grade?: string | null
          highlights?: string[]
          id?: string
          institution?: string | null
          is_current?: boolean
          item_key?: string | null
          location?: string | null
          resume_id: string
          sort_order?: number
          start_date?: string | null
          summary?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          area?: string | null
          degree?: string | null
          end_date?: string | null
          grade?: string | null
          highlights?: string[]
          id?: string
          institution?: string | null
          is_current?: boolean
          item_key?: string | null
          location?: string | null
          resume_id?: string
          sort_order?: number
          start_date?: string | null
          summary?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "education_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      experience: {
        Row: {
          company: string | null
          employment_type: string | null
          end_date: string | null
          highlights: string[]
          id: string
          is_current: boolean
          item_key: string | null
          location: string | null
          position: string | null
          resume_id: string
          sort_order: number
          start_date: string | null
          summary: string | null
          technologies: string[]
          url: string | null
          user_id: string
        }
        Insert: {
          company?: string | null
          employment_type?: string | null
          end_date?: string | null
          highlights?: string[]
          id?: string
          is_current?: boolean
          item_key?: string | null
          location?: string | null
          position?: string | null
          resume_id: string
          sort_order?: number
          start_date?: string | null
          summary?: string | null
          technologies?: string[]
          url?: string | null
          user_id: string
        }
        Update: {
          company?: string | null
          employment_type?: string | null
          end_date?: string | null
          highlights?: string[]
          id?: string
          is_current?: boolean
          item_key?: string | null
          location?: string | null
          position?: string | null
          resume_id?: string
          sort_order?: number
          start_date?: string | null
          summary?: string | null
          technologies?: string[]
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      exports: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          file_size_bytes: number | null
          format: Database["public"]["Enums"]["export_format"]
          id: string
          page_count: number | null
          resume_id: string | null
          status: Database["public"]["Enums"]["export_status"]
          storage_path: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          file_size_bytes?: number | null
          format: Database["public"]["Enums"]["export_format"]
          id?: string
          page_count?: number | null
          resume_id?: string | null
          status?: Database["public"]["Enums"]["export_status"]
          storage_path?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          file_size_bytes?: number | null
          format?: Database["public"]["Enums"]["export_format"]
          id?: string
          page_count?: number | null
          resume_id?: string | null
          status?: Database["public"]["Enums"]["export_status"]
          storage_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exports_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      interests: {
        Row: {
          id: string
          item_key: string | null
          keywords: string[]
          name: string | null
          resume_id: string
          sort_order: number
          user_id: string
        }
        Insert: {
          id?: string
          item_key?: string | null
          keywords?: string[]
          name?: string | null
          resume_id: string
          sort_order?: number
          user_id: string
        }
        Update: {
          id?: string
          item_key?: string | null
          keywords?: string[]
          name?: string | null
          resume_id?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interests_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      languages: {
        Row: {
          id: string
          item_key: string | null
          name: string | null
          proficiency: string | null
          resume_id: string
          sort_order: number
          user_id: string
        }
        Insert: {
          id?: string
          item_key?: string | null
          name?: string | null
          proficiency?: string | null
          resume_id: string
          sort_order?: number
          user_id: string
        }
        Update: {
          id?: string
          item_key?: string | null
          name?: string | null
          proficiency?: string | null
          resume_id?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "languages_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_credits: number
          ai_preferences: Json
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          headline: string | null
          id: string
          locale: string
          notification_preferences: Json
          onboarded_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          theme: string
          updated_at: string
        }
        Insert: {
          ai_credits?: number
          ai_preferences?: Json
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          headline?: string | null
          id: string
          locale?: string
          notification_preferences?: Json
          onboarded_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          theme?: string
          updated_at?: string
        }
        Update: {
          ai_credits?: number
          ai_preferences?: Json
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          headline?: string | null
          id?: string
          locale?: string
          notification_preferences?: Json
          onboarded_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          description: string | null
          end_date: string | null
          highlights: string[]
          id: string
          item_key: string | null
          name: string | null
          repo_url: string | null
          resume_id: string
          role: string | null
          sort_order: number
          start_date: string | null
          technologies: string[]
          url: string | null
          user_id: string
        }
        Insert: {
          description?: string | null
          end_date?: string | null
          highlights?: string[]
          id?: string
          item_key?: string | null
          name?: string | null
          repo_url?: string | null
          resume_id: string
          role?: string | null
          sort_order?: number
          start_date?: string | null
          technologies?: string[]
          url?: string | null
          user_id: string
        }
        Update: {
          description?: string | null
          end_date?: string | null
          highlights?: string[]
          id?: string
          item_key?: string | null
          name?: string | null
          repo_url?: string | null
          resume_id?: string
          role?: string | null
          sort_order?: number
          start_date?: string | null
          technologies?: string[]
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          id: string
          item_key: string | null
          name: string | null
          publisher: string | null
          released_on: string | null
          resume_id: string
          sort_order: number
          summary: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          id?: string
          item_key?: string | null
          name?: string | null
          publisher?: string | null
          released_on?: string | null
          resume_id: string
          sort_order?: number
          summary?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          id?: string
          item_key?: string | null
          name?: string | null
          publisher?: string | null
          released_on?: string | null
          resume_id?: string
          sort_order?: number
          summary?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publications_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_events: {
        Row: {
          action: string
          id: number
          occurred_at: string
          subject: string
        }
        Insert: {
          action: string
          id?: never
          occurred_at?: string
          subject: string
        }
        Update: {
          action?: string
          id?: never
          occurred_at?: string
          subject?: string
        }
        Relationships: []
      }
      resume_custom_entries: {
        Row: {
          dated_on: string | null
          description: string | null
          highlights: string[]
          id: string
          item_key: string | null
          name: string | null
          resume_id: string
          section_key: string | null
          sort_order: number
          subtitle: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          dated_on?: string | null
          description?: string | null
          highlights?: string[]
          id?: string
          item_key?: string | null
          name?: string | null
          resume_id: string
          section_key?: string | null
          sort_order?: number
          subtitle?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          dated_on?: string | null
          description?: string | null
          highlights?: string[]
          id?: string
          item_key?: string | null
          name?: string | null
          resume_id?: string
          section_key?: string | null
          sort_order?: number
          subtitle?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resume_custom_entries_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      resume_references: {
        Row: {
          company: string | null
          email: string | null
          id: string
          item_key: string | null
          name: string | null
          phone: string | null
          relationship: string | null
          resume_id: string
          sort_order: number
          summary: string | null
          user_id: string
        }
        Insert: {
          company?: string | null
          email?: string | null
          id?: string
          item_key?: string | null
          name?: string | null
          phone?: string | null
          relationship?: string | null
          resume_id: string
          sort_order?: number
          summary?: string | null
          user_id: string
        }
        Update: {
          company?: string | null
          email?: string | null
          id?: string
          item_key?: string | null
          name?: string | null
          phone?: string | null
          relationship?: string | null
          resume_id?: string
          sort_order?: number
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resume_references_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      resume_sections: {
        Row: {
          id: string
          is_visible: boolean
          item_count: number
          kind: string
          resume_id: string
          section_key: string | null
          sort_order: number
          title: string | null
          user_id: string
        }
        Insert: {
          id?: string
          is_visible?: boolean
          item_count?: number
          kind: string
          resume_id: string
          section_key?: string | null
          sort_order?: number
          title?: string | null
          user_id: string
        }
        Update: {
          id?: string
          is_visible?: boolean
          item_count?: number
          kind?: string
          resume_id?: string
          section_key?: string | null
          sort_order?: number
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resume_sections_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      resume_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_premium: boolean
          layout: string
          name: string
          palettes: Json
          preview_path: string | null
          sort_order: number
          tokens: Json
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id: string
          is_active?: boolean
          is_premium?: boolean
          layout: string
          name: string
          palettes?: Json
          preview_path?: string | null
          sort_order?: number
          tokens?: Json
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_premium?: boolean
          layout?: string
          name?: string
          palettes?: Json
          preview_path?: string | null
          sort_order?: number
          tokens?: Json
          updated_at?: string
        }
        Relationships: []
      }
      resume_versions: {
        Row: {
          content: Json
          created_at: string
          id: string
          label: string | null
          origin: string
          resume_id: string
          user_id: string
          version: number
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          label?: string | null
          origin?: string
          resume_id: string
          user_id: string
          version: number
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          label?: string | null
          origin?: string
          resume_id?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "resume_versions_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          allow_indexing: boolean
          content: Json
          created_at: string
          deleted_at: string | null
          download_count: number
          folder_id: string | null
          id: string
          is_favorite: boolean
          last_edited_at: string
          page: Json
          search_vector: unknown
          share_slug: string | null
          tags: string[]
          template_id: string
          theme: Json
          title: string
          updated_at: string
          user_id: string
          view_count: number
          visibility: Database["public"]["Enums"]["resume_visibility"]
        }
        Insert: {
          allow_indexing?: boolean
          content?: Json
          created_at?: string
          deleted_at?: string | null
          download_count?: number
          folder_id?: string | null
          id?: string
          is_favorite?: boolean
          last_edited_at?: string
          page?: Json
          search_vector?: unknown
          share_slug?: string | null
          tags?: string[]
          template_id?: string
          theme?: Json
          title?: string
          updated_at?: string
          user_id: string
          view_count?: number
          visibility?: Database["public"]["Enums"]["resume_visibility"]
        }
        Update: {
          allow_indexing?: boolean
          content?: Json
          created_at?: string
          deleted_at?: string | null
          download_count?: number
          folder_id?: string | null
          id?: string
          is_favorite?: boolean
          last_edited_at?: string
          page?: Json
          search_vector?: unknown
          share_slug?: string | null
          tags?: string[]
          template_id?: string
          theme?: Json
          title?: string
          updated_at?: string
          user_id?: string
          view_count?: number
          visibility?: Database["public"]["Enums"]["resume_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "resumes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resumes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "resume_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category: string | null
          id: string
          item_key: string | null
          keywords: string[]
          level: number | null
          name: string | null
          resume_id: string
          sort_order: number
          user_id: string
        }
        Insert: {
          category?: string | null
          id?: string
          item_key?: string | null
          keywords?: string[]
          level?: number | null
          name?: string | null
          resume_id: string
          sort_order?: number
          user_id: string
        }
        Update: {
          category?: string | null
          id?: string
          item_key?: string | null
          keywords?: string[]
          level?: number | null
          name?: string | null
          resume_id?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      social_links: {
        Row: {
          id: string
          item_key: string | null
          network: string | null
          resume_id: string
          sort_order: number
          url: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          id?: string
          item_key?: string | null
          network?: string | null
          resume_id: string
          sort_order?: number
          url?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          id?: string
          item_key?: string | null
          network?: string | null
          resume_id?: string
          sort_order?: number
          url?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_links_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          monthly_ai_credits: number
          plan: Database["public"]["Enums"]["subscription_plan"]
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          monthly_ai_credits?: number
          plan?: Database["public"]["Enums"]["subscription_plan"]
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          monthly_ai_credits?: number
          plan?: Database["public"]["Enums"]["subscription_plan"]
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      template_favorites: {
        Row: {
          created_at: string
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_favorites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "resume_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      array_to_search_text: { Args: { value: string[] }; Returns: string }
      charge_ai_credits: { Args: { p_amount: number }; Returns: number }
      check_rate_limit: {
        Args: {
          p_action: string
          p_max_count: number
          p_subject: string
          p_window: string
        }
        Returns: boolean
      }
      get_dashboard_stats: { Args: never; Returns: Json }
      get_public_resume: {
        Args: { p_share_slug: string }
        Returns: {
          allow_indexing: boolean
          content: Json
          id: string
          page: Json
          template_id: string
          theme: Json
          title: string
          updated_at: string
          view_count: number
        }[]
      }
      increment_resume_view: {
        Args: { p_share_slug: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      jsonb_to_bool: {
        Args: { fallback: boolean; value: Json }
        Returns: boolean
      }
      jsonb_to_text_array: { Args: { value: Json }; Returns: string[] }
      purge_trashed_resumes: { Args: { p_retention?: string }; Returns: number }
      resume_parse_date: { Args: { value: string }; Returns: string }
    }
    Enums: {
      export_format: "pdf" | "png" | "jpeg"
      export_status: "pending" | "processing" | "completed" | "failed"
      resume_visibility: "private" | "unlisted" | "public"
      subscription_plan: "free" | "pro" | "team"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
      user_role: "user" | "admin"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      export_format: ["pdf", "png", "jpeg"],
      export_status: ["pending", "processing", "completed", "failed"],
      resume_visibility: ["private", "unlisted", "public"],
      subscription_plan: ["free", "pro", "team"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
      ],
      user_role: ["user", "admin"],
    },
  },
} as const
