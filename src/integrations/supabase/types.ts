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
      chat_artifacts: {
        Row: {
          artifact_type: string
          chat_id: string
          created_at: string
          generation_time_ms: number
          html: string
          id: string
          line_count: number
          message_id: string | null
          model_used: string | null
          theme: string
          title: string
          user_id: string
        }
        Insert: {
          artifact_type: string
          chat_id: string
          created_at?: string
          generation_time_ms?: number
          html: string
          id?: string
          line_count?: number
          message_id?: string | null
          model_used?: string | null
          theme?: string
          title?: string
          user_id: string
        }
        Update: {
          artifact_type?: string
          chat_id?: string
          created_at?: string
          generation_time_ms?: number
          html?: string
          id?: string
          line_count?: number
          message_id?: string | null
          model_used?: string | null
          theme?: string
          title?: string
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
      concept_nodes: {
        Row: {
          chapter: string | null
          concept: string | null
          curriculum: string | null
          description: string | null
          difficulty: number | null
          id: string
          parent_concept: string | null
          subject: string | null
        }
        Insert: {
          chapter?: string | null
          concept?: string | null
          curriculum?: string | null
          description?: string | null
          difficulty?: number | null
          id?: string
          parent_concept?: string | null
          subject?: string | null
        }
        Update: {
          chapter?: string | null
          concept?: string | null
          curriculum?: string | null
          description?: string | null
          difficulty?: number | null
          id?: string
          parent_concept?: string | null
          subject?: string | null
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
      data_access_audit: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          filters: Json | null
          id: string
          record_count: number | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          filters?: Json | null
          id?: string
          record_count?: number | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          filters?: Json | null
          id?: string
          record_count?: number | null
        }
        Relationships: []
      }
      data_consent: {
        Row: {
          consented_at: string
          training_data_opt_in: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          consented_at?: string
          training_data_opt_in?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          consented_at?: string
          training_data_opt_in?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exam_packs: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          description: string
          emoji: string
          id: string
          level: string
          original_price_cents: number
          price_cents: number
          product_id: string
          sort_order: number
          subject: string
          title: string
          updated_at: string
          whats_inside: Json
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string
          emoji?: string
          id?: string
          level: string
          original_price_cents?: number
          price_cents?: number
          product_id: string
          sort_order?: number
          subject: string
          title: string
          updated_at?: string
          whats_inside?: Json
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string
          emoji?: string
          id?: string
          level?: string
          original_price_cents?: number
          price_cents?: number
          product_id?: string
          sort_order?: number
          subject?: string
          title?: string
          updated_at?: string
          whats_inside?: Json
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
      flashcard_srs: {
        Row: {
          back: string
          created_at: string | null
          due_date: string | null
          ease_factor: number | null
          flashcard_id: string | null
          front: string
          id: string
          interval_days: number | null
          last_reviewed: string | null
          repetitions: number | null
          source: string | null
          subject: string | null
          topic: string | null
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string | null
          due_date?: string | null
          ease_factor?: number | null
          flashcard_id?: string | null
          front: string
          id?: string
          interval_days?: number | null
          last_reviewed?: string | null
          repetitions?: number | null
          source?: string | null
          subject?: string | null
          topic?: string | null
          user_id: string
        }
        Update: {
          back?: string
          created_at?: string | null
          due_date?: string | null
          ease_factor?: number | null
          flashcard_id?: string | null
          front?: string
          id?: string
          interval_days?: number | null
          last_reviewed?: string | null
          repetitions?: number | null
          source?: string | null
          subject?: string | null
          topic?: string | null
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
      game_sessions: {
        Row: {
          coins_earned: number
          created_at: string
          data: Json | null
          game_mode: string
          id: string
          score: number
          user_id: string
          xp_earned: number
        }
        Insert: {
          coins_earned?: number
          created_at?: string
          data?: Json | null
          game_mode: string
          id?: string
          score?: number
          user_id: string
          xp_earned?: number
        }
        Update: {
          coins_earned?: number
          created_at?: string
          data?: Json | null
          game_mode?: string
          id?: string
          score?: number
          user_id?: string
          xp_earned?: number
        }
        Relationships: []
      }
      guided_lessons: {
        Row: {
          completed_at: string | null
          correct_answers: number | null
          created_at: string | null
          difficulty: string | null
          id: string
          lesson_data: Json | null
          score: number | null
          steps_completed: number | null
          topic: string
          total_questions: number | null
          total_steps: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          correct_answers?: number | null
          created_at?: string | null
          difficulty?: string | null
          id?: string
          lesson_data?: Json | null
          score?: number | null
          steps_completed?: number | null
          topic: string
          total_questions?: number | null
          total_steps?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          correct_answers?: number | null
          created_at?: string | null
          difficulty?: string | null
          id?: string
          lesson_data?: Json | null
          score?: number | null
          steps_completed?: number | null
          topic?: string
          total_questions?: number | null
          total_steps?: number | null
          user_id?: string
        }
        Relationships: []
      }
      leaderboard_entries: {
        Row: {
          avatar_url: string | null
          display_name: string
          id: string
          level: number
          period: string
          period_start: string
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string
          id?: string
          level?: number
          period?: string
          period_start?: string
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          display_name?: string
          id?: string
          level?: number
          period?: string
          period_start?: string
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      learning_answers: {
        Row: {
          answer_text: string
          created_at: string | null
          id: string
          is_final: boolean | null
          model_used: string | null
          quality_score: number | null
          question_id: string | null
        }
        Insert: {
          answer_text: string
          created_at?: string | null
          id?: string
          is_final?: boolean | null
          model_used?: string | null
          quality_score?: number | null
          question_id?: string | null
        }
        Update: {
          answer_text?: string
          created_at?: string | null
          id?: string
          is_final?: boolean | null
          model_used?: string | null
          quality_score?: number | null
          question_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "learning_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_corrections: {
        Row: {
          corrected_answer: string
          correction_source: string | null
          created_at: string | null
          id: string
          original_answer_id: string | null
          question_id: string | null
        }
        Insert: {
          corrected_answer: string
          correction_source?: string | null
          created_at?: string | null
          id?: string
          original_answer_id?: string | null
          question_id?: string | null
        }
        Update: {
          corrected_answer?: string
          correction_source?: string | null
          created_at?: string | null
          id?: string
          original_answer_id?: string | null
          question_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_corrections_original_answer_id_fkey"
            columns: ["original_answer_id"]
            isOneToOne: false
            referencedRelation: "learning_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_corrections_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "learning_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_feedback: {
        Row: {
          correction_text: string | null
          created_at: string
          feedback_type: string
          id: string
          interaction_id: string
          user_id: string
        }
        Insert: {
          correction_text?: string | null
          created_at?: string
          feedback_type: string
          id?: string
          interaction_id: string
          user_id: string
        }
        Update: {
          correction_text?: string | null
          created_at?: string
          feedback_type?: string
          id?: string
          interaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_feedback_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "learning_interactions"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_interactions: {
        Row: {
          ai_response: string
          concepts: string[] | null
          created_at: string
          device_type: string | null
          difficulty: string | null
          exported_at: string | null
          feedback: string | null
          follow_up: boolean | null
          id: string
          language: string | null
          latency_ms: number | null
          model_used: string | null
          pii_scrubbed: boolean
          quality_score: number | null
          session_id: string
          source: string | null
          steps: Json | null
          subject: string | null
          topic: string | null
          understood: string | null
          user_correction: string | null
          user_id: string | null
          user_input: string
        }
        Insert: {
          ai_response: string
          concepts?: string[] | null
          created_at?: string
          device_type?: string | null
          difficulty?: string | null
          exported_at?: string | null
          feedback?: string | null
          follow_up?: boolean | null
          id?: string
          language?: string | null
          latency_ms?: number | null
          model_used?: string | null
          pii_scrubbed?: boolean
          quality_score?: number | null
          session_id: string
          source?: string | null
          steps?: Json | null
          subject?: string | null
          topic?: string | null
          understood?: string | null
          user_correction?: string | null
          user_id?: string | null
          user_input: string
        }
        Update: {
          ai_response?: string
          concepts?: string[] | null
          created_at?: string
          device_type?: string | null
          difficulty?: string | null
          exported_at?: string | null
          feedback?: string | null
          follow_up?: boolean | null
          id?: string
          language?: string | null
          latency_ms?: number | null
          model_used?: string | null
          pii_scrubbed?: boolean
          quality_score?: number | null
          session_id?: string
          source?: string | null
          steps?: Json | null
          subject?: string | null
          topic?: string | null
          understood?: string | null
          user_correction?: string | null
          user_id?: string | null
          user_input?: string
        }
        Relationships: []
      }
      learning_performance: {
        Row: {
          attempts_count: number | null
          created_at: string | null
          id: string
          question_id: string | null
          time_taken: number | null
          user_id: string | null
          was_correct: boolean | null
        }
        Insert: {
          attempts_count?: number | null
          created_at?: string | null
          id?: string
          question_id?: string | null
          time_taken?: number | null
          user_id?: string | null
          was_correct?: boolean | null
        }
        Update: {
          attempts_count?: number | null
          created_at?: string | null
          id?: string
          question_id?: string | null
          time_taken?: number | null
          user_id?: string | null
          was_correct?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_performance_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "learning_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_questions: {
        Row: {
          created_at: string | null
          difficulty_level: string | null
          id: string
          question_hash: string | null
          question_text: string
          source: string | null
          subject: string | null
          subtopic: string | null
          topic: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          difficulty_level?: string | null
          id?: string
          question_hash?: string | null
          question_text: string
          source?: string | null
          subject?: string | null
          subtopic?: string | null
          topic?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          difficulty_level?: string | null
          id?: string
          question_hash?: string | null
          question_text?: string
          source?: string | null
          subject?: string | null
          subtopic?: string | null
          topic?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      mistake_tags: {
        Row: {
          ai_explanation: string | null
          concept: string | null
          created_at: string | null
          error_type: string | null
          id: string
          response_id: string | null
          subject: string | null
          topic: string | null
          user_id: string
        }
        Insert: {
          ai_explanation?: string | null
          concept?: string | null
          created_at?: string | null
          error_type?: string | null
          id?: string
          response_id?: string | null
          subject?: string | null
          topic?: string | null
          user_id: string
        }
        Update: {
          ai_explanation?: string | null
          concept?: string | null
          created_at?: string | null
          error_type?: string | null
          id?: string
          response_id?: string | null
          subject?: string | null
          topic?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mistake_tags_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "question_responses"
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
      parent_links: {
        Row: {
          access_code: string | null
          id: string
          linked_at: string | null
          parent_email: string | null
          student_id: string
        }
        Insert: {
          access_code?: string | null
          id?: string
          linked_at?: string | null
          parent_email?: string | null
          student_id: string
        }
        Update: {
          access_code?: string | null
          id?: string
          linked_at?: string | null
          parent_email?: string | null
          student_id?: string
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
      question_responses: {
        Row: {
          attempt_id: string | null
          concept: string | null
          correct_answer: string | null
          created_at: string | null
          difficulty: string | null
          id: string
          is_correct: boolean | null
          question_id: string | null
          question_text: string | null
          student_answer: string | null
          subject: string | null
          time_spent_seconds: number | null
          topic: string | null
          user_id: string
        }
        Insert: {
          attempt_id?: string | null
          concept?: string | null
          correct_answer?: string | null
          created_at?: string | null
          difficulty?: string | null
          id?: string
          is_correct?: boolean | null
          question_id?: string | null
          question_text?: string | null
          student_answer?: string | null
          subject?: string | null
          time_spent_seconds?: number | null
          topic?: string | null
          user_id: string
        }
        Update: {
          attempt_id?: string | null
          concept?: string | null
          correct_answer?: string | null
          created_at?: string | null
          difficulty?: string | null
          id?: string
          is_correct?: boolean | null
          question_id?: string | null
          question_text?: string | null
          student_answer?: string | null
          subject?: string | null
          time_spent_seconds?: number | null
          topic?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_responses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      readiness_history: {
        Row: {
          components: Json | null
          date: string
          id: string
          projected_score: number | null
          score: number
          user_id: string
        }
        Insert: {
          components?: Json | null
          date: string
          id?: string
          projected_score?: number | null
          score: number
          user_id: string
        }
        Update: {
          components?: Json | null
          date?: string
          id?: string
          projected_score?: number | null
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          content: Json
          created_at: string
          curriculum: string
          id: string
          quality_score: number | null
          resource_type: string
          subject: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          curriculum: string
          id?: string
          quality_score?: number | null
          resource_type?: string
          subject: string
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          curriculum?: string
          id?: string
          quality_score?: number | null
          resource_type?: string
          subject?: string
          topic?: string
          updated_at?: string
          user_id?: string
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
      squad_activity: {
        Row: {
          activity_type: string | null
          created_at: string | null
          description: string | null
          id: string
          squad_id: string | null
          user_id: string
          xp_earned: number | null
        }
        Insert: {
          activity_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          squad_id?: string | null
          user_id: string
          xp_earned?: number | null
        }
        Update: {
          activity_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          squad_id?: string | null
          user_id?: string
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "squad_activity_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_members: {
        Row: {
          display_name: string | null
          id: string
          joined_at: string | null
          squad_id: string | null
          user_id: string
        }
        Insert: {
          display_name?: string | null
          id?: string
          joined_at?: string | null
          squad_id?: string | null
          user_id: string
        }
        Update: {
          display_name?: string | null
          id?: string
          joined_at?: string | null
          squad_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_members_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_messages: {
        Row: {
          content: string
          created_at: string | null
          display_name: string | null
          id: string
          role: string
          squad_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          role?: string
          squad_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          role?: string
          squad_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_messages_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      squads: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          invite_code: string | null
          name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          invite_code?: string | null
          name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          invite_code?: string | null
          name?: string
        }
        Relationships: []
      }
      srs_reviews: {
        Row: {
          card_id: string | null
          id: string
          rating: number | null
          reviewed_at: string | null
          user_id: string
        }
        Insert: {
          card_id?: string | null
          id?: string
          rating?: number | null
          reviewed_at?: string | null
          user_id: string
        }
        Update: {
          card_id?: string | null
          id?: string
          rating?: number | null
          reviewed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "srs_reviews_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "flashcard_srs"
            referencedColumns: ["id"]
          },
        ]
      }
      step_by_step_solutions: {
        Row: {
          created_at: string | null
          final_answer: string | null
          id: string
          question_id: string | null
          steps: Json
        }
        Insert: {
          created_at?: string | null
          final_answer?: string | null
          id?: string
          question_id?: string | null
          steps?: Json
        }
        Update: {
          created_at?: string | null
          final_answer?: string | null
          id?: string
          question_id?: string | null
          steps?: Json
        }
        Relationships: [
          {
            foreignKeyName: "step_by_step_solutions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "learning_questions"
            referencedColumns: ["id"]
          },
        ]
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
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      test_attempts: {
        Row: {
          completed_at: string | null
          curriculum: string | null
          id: string
          max_score: number | null
          score: number | null
          started_at: string | null
          subject: string | null
          test_id: string | null
          time_taken_seconds: number | null
          topic: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          curriculum?: string | null
          id?: string
          max_score?: number | null
          score?: number | null
          started_at?: string | null
          subject?: string | null
          test_id?: string | null
          time_taken_seconds?: number | null
          topic?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          curriculum?: string | null
          id?: string
          max_score?: number | null
          score?: number | null
          started_at?: string | null
          subject?: string | null
          test_id?: string | null
          time_taken_seconds?: number | null
          topic?: string | null
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
      usage_tracking: {
        Row: {
          created_at: string
          feature: string
          id: string
          period_start: string
          period_type: string
          updated_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          feature: string
          id?: string
          period_start?: string
          period_type?: string
          updated_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          feature?: string
          id?: string
          period_start?: string
          period_type?: string
          updated_at?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: []
      }
      user_concept_mastery: {
        Row: {
          concept_id: string | null
          id: string
          last_tested: string | null
          mastery_pct: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          concept_id?: string | null
          id?: string
          last_tested?: string | null
          mastery_pct?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          concept_id?: string | null
          id?: string
          last_tested?: string | null
          mastery_pct?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_concept_mastery_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concept_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_goals: {
        Row: {
          created_at: string | null
          curriculum: string | null
          exam: string
          exam_date: string
          id: string
          max_score: number | null
          target_score: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          curriculum?: string | null
          exam: string
          exam_date: string
          id?: string
          max_score?: number | null
          target_score?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          curriculum?: string | null
          exam?: string
          exam_date?: string
          id?: string
          max_score?: number | null
          target_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_memory: {
        Row: {
          confidence: number | null
          created_at: string | null
          expires_at: string | null
          id: string
          key: string
          memory_type: string
          updated_at: string | null
          user_id: string
          value: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key: string
          memory_type: string
          updated_at?: string | null
          user_id: string
          value: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key?: string
          memory_type?: string
          updated_at?: string | null
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      user_unlocked_packs: {
        Row: {
          generated_at: string | null
          html_storage_path: string | null
          id: string
          pack_id: string
          payment_id: string | null
          payment_status: string
          product_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          generated_at?: string | null
          html_storage_path?: string | null
          id?: string
          pack_id: string
          payment_id?: string | null
          payment_status?: string
          product_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          generated_at?: string | null
          html_storage_path?: string | null
          id?: string
          pack_id?: string
          payment_id?: string | null
          payment_status?: string
          product_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_unlocked_packs_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "exam_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_stats: {
        Row: {
          avg_score: number | null
          id: string
          study_minutes: number | null
          tests_taken: number | null
          topics_covered: string[] | null
          user_id: string
          week_start: string | null
          xp_earned: number | null
        }
        Insert: {
          avg_score?: number | null
          id?: string
          study_minutes?: number | null
          tests_taken?: number | null
          topics_covered?: string[] | null
          user_id: string
          week_start?: string | null
          xp_earned?: number | null
        }
        Update: {
          avg_score?: number | null
          id?: string
          study_minutes?: number | null
          tests_taken?: number | null
          topics_covered?: string[] | null
          user_id?: string
          week_start?: string | null
          xp_earned?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_xp_coins: {
        Args: { p_coins: number; p_user_id: string; p_xp: number }
        Returns: Json
      }
      get_usage_count: {
        Args: { p_feature: string; p_period_type?: string; p_user_id: string }
        Returns: number
      }
      increment_study_minutes: {
        Args: { p_minutes: number; p_user_id: string }
        Returns: undefined
      }
      increment_usage: {
        Args: { p_feature: string; p_period_type?: string; p_user_id: string }
        Returns: number
      }
      sync_leaderboard: { Args: { p_user_id: string }; Returns: undefined }
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
