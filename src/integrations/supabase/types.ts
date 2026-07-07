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
      activities: {
        Row: {
          created_at: string
          id: string
          investigation_id: string
          level: string
          message: string
          meta: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          investigation_id: string
          level?: string
          message: string
          meta?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          investigation_id?: string
          level?: string
          message?: string
          meta?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          content: string | null
          created_at: string
          extracted: Json
          id: string
          investigation_id: string
          kind: Database["public"]["Enums"]["evidence_kind"]
          label: string | null
          mime_type: string | null
          size_bytes: number | null
          storage_path: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          extracted?: Json
          id?: string
          investigation_id: string
          kind: Database["public"]["Enums"]["evidence_kind"]
          label?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          extracted?: Json
          id?: string
          investigation_id?: string
          kind?: Database["public"]["Enums"]["evidence_kind"]
          label?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      global_signals: {
        Row: {
          first_seen: string
          hash: string
          id: string
          kind: Database["public"]["Enums"]["signal_kind"]
          last_seen: string
          report_count: number
          sample_context: string | null
          severity: Database["public"]["Enums"]["signal_severity"]
          source: string
        }
        Insert: {
          first_seen?: string
          hash: string
          id?: string
          kind: Database["public"]["Enums"]["signal_kind"]
          last_seen?: string
          report_count?: number
          sample_context?: string | null
          severity?: Database["public"]["Enums"]["signal_severity"]
          source?: string
        }
        Update: {
          first_seen?: string
          hash?: string
          id?: string
          kind?: Database["public"]["Enums"]["signal_kind"]
          last_seen?: string
          report_count?: number
          sample_context?: string | null
          severity?: Database["public"]["Enums"]["signal_severity"]
          source?: string
        }
        Relationships: []
      }
      investigation_signals: {
        Row: {
          created_at: string
          id: string
          investigation_id: string
          matched_value_preview: string
          signal_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          investigation_id: string
          matched_value_preview: string
          signal_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          investigation_id?: string
          matched_value_preview?: string
          signal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_signals_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_signals_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "global_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      investigations: {
        Row: {
          best_model: string | null
          completed_at: string | null
          created_at: string
          id: string
          name: string
          progress: number
          risk_category: Database["public"]["Enums"]["risk_category"] | null
          status: Database["public"]["Enums"]["investigation_status"]
          trust_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          best_model?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          name: string
          progress?: number
          risk_category?: Database["public"]["Enums"]["risk_category"] | null
          status?: Database["public"]["Enums"]["investigation_status"]
          trust_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          best_model?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          name?: string
          progress?: number
          risk_category?: Database["public"]["Enums"]["risk_category"] | null
          status?: Database["public"]["Enums"]["investigation_status"]
          trust_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ml_predictions: {
        Row: {
          confidence: number
          created_at: string
          feature_importance: Json
          features: Json
          id: string
          investigation_id: string
          model_used: string
          prediction_score: number
          risk_category: Database["public"]["Enums"]["risk_category"]
          user_id: string
        }
        Insert: {
          confidence: number
          created_at?: string
          feature_importance?: Json
          features?: Json
          id?: string
          investigation_id: string
          model_used: string
          prediction_score: number
          risk_category: Database["public"]["Enums"]["risk_category"]
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          feature_importance?: Json
          features?: Json
          id?: string
          investigation_id?: string
          model_used?: string
          prediction_score?: number
          risk_category?: Database["public"]["Enums"]["risk_category"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ml_predictions_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      trust_reports: {
        Row: {
          created_at: string
          full_report: Json
          id: string
          investigation_id: string
          missing_evidence: Json
          negative_findings: Json
          positive_findings: Json
          recommendation: string
          summary: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_report?: Json
          id?: string
          investigation_id: string
          missing_evidence?: Json
          negative_findings?: Json
          positive_findings?: Json
          recommendation: string
          summary: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_report?: Json
          id?: string
          investigation_id?: string
          missing_evidence?: Json
          negative_findings?: Json
          positive_findings?: Json
          recommendation?: string
          summary?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trust_reports_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: true
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      verifications: {
        Row: {
          category: string
          check_name: string
          created_at: string
          id: string
          investigation_id: string
          result: Json
          score: number | null
          status: Database["public"]["Enums"]["verification_status"]
          user_id: string
          weight: number
        }
        Insert: {
          category: string
          check_name: string
          created_at?: string
          id?: string
          investigation_id: string
          result?: Json
          score?: number | null
          status?: Database["public"]["Enums"]["verification_status"]
          user_id: string
          weight?: number
        }
        Update: {
          category?: string
          check_name?: string
          created_at?: string
          id?: string
          investigation_id?: string
          result?: Json
          score?: number | null
          status?: Database["public"]["Enums"]["verification_status"]
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "verifications_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      evidence_kind: "url" | "file" | "text"
      investigation_status:
        | "draft"
        | "collecting"
        | "verifying"
        | "scoring"
        | "explaining"
        | "completed"
        | "failed"
      risk_category:
        | "trusted"
        | "likely_safe"
        | "caution"
        | "high_risk"
        | "fraudulent"
      signal_kind:
        | "email"
        | "phone"
        | "domain"
        | "recruiter"
        | "payment_handle"
        | "offer_pattern"
      signal_severity: "info" | "warning" | "high" | "critical"
      verification_status:
        | "pending"
        | "running"
        | "pass"
        | "fail"
        | "warning"
        | "skipped"
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
      evidence_kind: ["url", "file", "text"],
      investigation_status: [
        "draft",
        "collecting",
        "verifying",
        "scoring",
        "explaining",
        "completed",
        "failed",
      ],
      risk_category: [
        "trusted",
        "likely_safe",
        "caution",
        "high_risk",
        "fraudulent",
      ],
      signal_kind: [
        "email",
        "phone",
        "domain",
        "recruiter",
        "payment_handle",
        "offer_pattern",
      ],
      signal_severity: ["info", "warning", "high", "critical"],
      verification_status: [
        "pending",
        "running",
        "pass",
        "fail",
        "warning",
        "skipped",
      ],
    },
  },
} as const
