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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          badge_icon: string | null
          badge_name: string
          description: string | null
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_icon?: string | null
          badge_name: string
          description?: string | null
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_icon?: string | null
          badge_name?: string
          description?: string | null
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          chat_type: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_type?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_type?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_quests: {
        Row: {
          coin_reward: number
          completed: boolean
          created_at: string
          description: string
          id: string
          progress: number
          quest_date: string
          quest_type: string
          target: number
          user_id: string
          xp_reward: number
        }
        Insert: {
          coin_reward?: number
          completed?: boolean
          created_at?: string
          description: string
          id?: string
          progress?: number
          quest_date?: string
          quest_type: string
          target?: number
          user_id: string
          xp_reward?: number
        }
        Update: {
          coin_reward?: number
          completed?: boolean
          created_at?: string
          description?: string
          id?: string
          progress?: number
          quest_date?: string
          quest_type?: string
          target?: number
          user_id?: string
          xp_reward?: number
        }
        Relationships: []
      }
      flashcard_decks: {
        Row: {
          card_count: number
          created_at: string
          id: string
          source: string | null
          subject: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_count?: number
          created_at?: string
          id?: string
          source?: string | null
          subject?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_count?: number
          created_at?: string
          id?: string
          source?: string | null
          subject?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          back: string
          created_at: string
          deck_id: string
          difficulty: number
          ease_factor: number
          front: string
          id: string
          next_review: string | null
          review_count: number
        }
        Insert: {
          back: string
          created_at?: string
          deck_id: string
          difficulty?: number
          ease_factor?: number
          front: string
          id?: string
          next_review?: string | null
          review_count?: number
        }
        Update: {
          back?: string
          created_at?: string
          deck_id?: string
          difficulty?: number
          ease_factor?: number
          front?: string
          id?: string
          next_review?: string | null
          review_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "flashcard_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      mistakes: {
        Row: {
          correct_answer: string | null
          created_at: string
          id: string
          mistake_type: string
          question: string | null
          subject: string | null
          topic: string
          user_answer: string | null
          user_id: string
        }
        Insert: {
          correct_answer?: string | null
          created_at?: string
          id?: string
          mistake_type?: string
          question?: string | null
          subject?: string | null
          topic: string
          user_answer?: string | null
          user_id: string
        }
        Update: {
          correct_answer?: string | null
          created_at?: string
          id?: string
          mistake_type?: string
          question?: string | null
          subject?: string | null
          topic?: string
          user_answer?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          coins: number
          created_at: string
          difficulty: string | null
          display_name: string | null
          extra_preferences: string | null
          gamification_mode: string | null
          id: string
          last_study_date: string | null
          learning_style: string | null
          level: number
          streak_days: number
          study_mode: string | null
          theme: string | null
          total_study_minutes: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          coins?: number
          created_at?: string
          difficulty?: string | null
          display_name?: string | null
          extra_preferences?: string | null
          gamification_mode?: string | null
          id?: string
          last_study_date?: string | null
          learning_style?: string | null
          level?: number
          streak_days?: number
          study_mode?: string | null
          theme?: string | null
          total_study_minutes?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          coins?: number
          created_at?: string
          difficulty?: string | null
          display_name?: string | null
          extra_preferences?: string | null
          gamification_mode?: string | null
          id?: string
          last_study_date?: string | null
          learning_style?: string | null
          level?: number
          streak_days?: number
          study_mode?: string | null
          theme?: string | null
          total_study_minutes?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      saved_lectures: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          podcast_script: string | null
          source_type: string | null
          title: string
          transcript_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          podcast_script?: string | null
          source_type?: string | null
          title?: string
          transcript_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          podcast_script?: string | null
          source_type?: string | null
          title?: string
          transcript_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_plans: {
        Row: {
          created_at: string
          daily_hours: number
          exam_date: string
          id: string
          plan_data: Json
          subjects: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_hours?: number
          exam_date: string
          id?: string
          plan_data?: Json
          subjects?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_hours?: number
          exam_date?: string
          id?: string
          plan_data?: Json
          subjects?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          analysis: Json | null
          doubts_solved: number
          duration_minutes: number
          ended_at: string | null
          flashcards_reviewed: number
          id: string
          notes_generated: number
          started_at: string
          status: string
          test_scores: Json | null
          tests_taken: number
          tools_used: Json | null
          user_id: string
        }
        Insert: {
          analysis?: Json | null
          doubts_solved?: number
          duration_minutes?: number
          ended_at?: string | null
          flashcards_reviewed?: number
          id?: string
          notes_generated?: number
          started_at?: string
          status?: string
          test_scores?: Json | null
          tests_taken?: number
          tools_used?: Json | null
          user_id: string
        }
        Update: {
          analysis?: Json | null
          doubts_solved?: number
          duration_minutes?: number
          ended_at?: string | null
          flashcards_reviewed?: number
          id?: string
          notes_generated?: number
          started_at?: string
          status?: string
          test_scores?: Json | null
          tests_taken?: number
          tools_used?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      tests: {
        Row: {
          analysis: Json | null
          answers: Json | null
          correct_answers: number
          created_at: string
          id: string
          questions: Json | null
          score: number | null
          status: string
          subject: string | null
          syllabus: string | null
          title: string
          total_questions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json | null
          answers?: Json | null
          correct_answers?: number
          created_at?: string
          id?: string
          questions?: Json | null
          score?: number | null
          status?: string
          subject?: string | null
          syllabus?: string | null
          title: string
          total_questions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json | null
          answers?: Json | null
          correct_answers?: number
          created_at?: string
          id?: string
          questions?: Json | null
          score?: number | null
          status?: string
          subject?: string | null
          syllabus?: string | null
          title?: string
          total_questions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transcription_jobs: {
        Row: {
          created_at: string | null
          error: string | null
          id: string
          result: Json | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          id?: string
          result?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          error?: string | null
          id?: string
          result?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_study_minutes: {
        Args: { p_minutes: number; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
