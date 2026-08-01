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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      campaign_treasuries: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          reserved_balance: number
          treasury_balance: number
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          reserved_balance?: number
          treasury_balance?: number
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          reserved_balance?: number
          treasury_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          brand_id: string
          category: string | null
          cooldown_seconds: number
          cover_image_url: string | null
          created_at: string
          description: string
          id: string
          instructions: string | null
          max_per_user: number
          max_submissions: number | null
          min_trust_score: number
          proof_type: Database["public"]["Enums"]["proof_type"]
          reward_amount: number
          spent_budget: number
          status: Database["public"]["Enums"]["campaign_status"]
          title: string
          total_budget: number
          updated_at: string
        }
        Insert: {
          brand_id: string
          category?: string | null
          cooldown_seconds?: number
          cover_image_url?: string | null
          created_at?: string
          description: string
          id?: string
          instructions?: string | null
          max_per_user?: number
          max_submissions?: number | null
          min_trust_score?: number
          proof_type?: Database["public"]["Enums"]["proof_type"]
          reward_amount: number
          spent_budget?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          title: string
          total_budget: number
          updated_at?: string
        }
        Update: {
          brand_id?: string
          category?: string | null
          cooldown_seconds?: number
          cover_image_url?: string | null
          created_at?: string
          description?: string
          id?: string
          instructions?: string | null
          max_per_user?: number
          max_submissions?: number | null
          min_trust_score?: number
          proof_type?: Database["public"]["Enums"]["proof_type"]
          reward_amount?: number
          spent_budget?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          title?: string
          total_budget?: number
          updated_at?: string
        }
        Relationships: []
      }
      disposable_email_domains: {
        Row: {
          created_at: string
          domain: string
        }
        Insert: {
          created_at?: string
          domain: string
        }
        Update: {
          created_at?: string
          domain?: string
        }
        Relationships: []
      }
      payout_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          destination: string | null
          id: string
          method: string
          processed_at: string | null
          status: Database["public"]["Enums"]["payout_status"]
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          destination?: string | null
          id?: string
          method?: string
          processed_at?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          destination?: string | null
          id?: string
          method?: string
          processed_at?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved_submissions: number
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          total_earned: number
          total_submissions: number
          trust_score: number
          updated_at: string
          wallet_address: string | null
          wallet_balance: number
        }
        Insert: {
          approved_submissions?: number
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          total_earned?: number
          total_submissions?: number
          trust_score?: number
          updated_at?: string
          wallet_address?: string | null
          wallet_balance?: number
        }
        Update: {
          approved_submissions?: number
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          total_earned?: number
          total_submissions?: number
          trust_score?: number
          updated_at?: string
          wallet_address?: string | null
          wallet_balance?: number
        }
        Relationships: []
      }
      reward_claims: {
        Row: {
          amount: number
          campaign_id: string
          created_at: string
          error: string | null
          id: string
          settled_at: string | null
          status: Database["public"]["Enums"]["claim_status"]
          submission_id: string
          tx_hash: string | null
          user_id: string
          wallet_address: string
        }
        Insert: {
          amount: number
          campaign_id: string
          created_at?: string
          error?: string | null
          id?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submission_id: string
          tx_hash?: string | null
          user_id: string
          wallet_address: string
        }
        Update: {
          amount?: number
          campaign_id?: string
          created_at?: string
          error?: string | null
          id?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submission_id?: string
          tx_hash?: string | null
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_claims_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_claims_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_fingerprints: {
        Row: {
          created_at: string
          device_hash: string | null
          email: string | null
          id: string
          ip_address: string | null
          submission_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_hash?: string | null
          email?: string | null
          id?: string
          ip_address?: string | null
          submission_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_hash?: string | null
          email?: string | null
          id?: string
          ip_address?: string | null
          submission_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          ai_confidence_score: number | null
          ai_feedback: string | null
          ai_quality_score: number | null
          ai_relevance_score: number | null
          ai_spam_score: number | null
          campaign_id: string
          claim_status: Database["public"]["Enums"]["claim_status"]
          claimed_at: string | null
          content_hash: string | null
          created_at: string
          id: string
          proof_image_url: string | null
          proof_text: string | null
          proof_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reward_paid: number | null
          status: Database["public"]["Enums"]["submission_status"]
          tx_hash: string | null
          user_id: string
        }
        Insert: {
          ai_confidence_score?: number | null
          ai_feedback?: string | null
          ai_quality_score?: number | null
          ai_relevance_score?: number | null
          ai_spam_score?: number | null
          campaign_id: string
          claim_status?: Database["public"]["Enums"]["claim_status"]
          claimed_at?: string | null
          content_hash?: string | null
          created_at?: string
          id?: string
          proof_image_url?: string | null
          proof_text?: string | null
          proof_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reward_paid?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          tx_hash?: string | null
          user_id: string
        }
        Update: {
          ai_confidence_score?: number | null
          ai_feedback?: string | null
          ai_quality_score?: number | null
          ai_relevance_score?: number | null
          ai_spam_score?: number | null
          campaign_id?: string
          claim_status?: Database["public"]["Enums"]["claim_status"]
          claimed_at?: string | null
          content_hash?: string | null
          created_at?: string
          id?: string
          proof_image_url?: string | null
          proof_text?: string | null
          proof_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reward_paid?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          tx_hash?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_transactions: {
        Row: {
          amount: number
          brand_id: string
          campaign_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["treasury_tx_kind"]
          note: string | null
          submission_id: string | null
          treasury_id: string
          tx_hash: string | null
        }
        Insert: {
          amount: number
          brand_id: string
          campaign_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["treasury_tx_kind"]
          note?: string | null
          submission_id?: string | null
          treasury_id: string
          tx_hash?: string | null
        }
        Update: {
          amount?: number
          brand_id?: string
          campaign_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["treasury_tx_kind"]
          note?: string | null
          submission_id?: string | null
          treasury_id?: string
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treasury_transactions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_transactions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_transactions_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "campaign_treasuries"
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
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["wallet_tx_kind"]
          note: string | null
          payout_request_id: string | null
          submission_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["wallet_tx_kind"]
          note?: string | null
          payout_request_id?: string | null
          submission_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["wallet_tx_kind"]
          note?: string | null
          payout_request_id?: string | null
          submission_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "brand" | "user"
      campaign_status: "draft" | "active" | "paused" | "completed"
      claim_status: "unclaimed" | "claimable" | "claiming" | "paid" | "failed"
      payout_status: "pending" | "approved" | "paid" | "rejected"
      proof_type: "screenshot" | "link" | "image" | "text"
      submission_status:
        | "pending"
        | "queued"
        | "ai_reviewing"
        | "approved"
        | "rejected"
        | "paid"
      treasury_tx_kind: "fund" | "reserve" | "release" | "spend" | "refund"
      wallet_tx_kind: "earn" | "payout" | "refund" | "adjustment"
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
      app_role: ["admin", "brand", "user"],
      campaign_status: ["draft", "active", "paused", "completed"],
      claim_status: ["unclaimed", "claimable", "claiming", "paid", "failed"],
      payout_status: ["pending", "approved", "paid", "rejected"],
      proof_type: ["screenshot", "link", "image", "text"],
      submission_status: [
        "pending",
        "queued",
        "ai_reviewing",
        "approved",
        "rejected",
        "paid",
      ],
      treasury_tx_kind: ["fund", "reserve", "release", "spend", "refund"],
      wallet_tx_kind: ["earn", "payout", "refund", "adjustment"],
    },
  },
} as const
