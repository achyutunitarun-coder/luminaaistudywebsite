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
      activity_log: {
        Row: {
          action: string
          category: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json
          page_url: string | null
          user_id: string
        }
        Insert: {
          action: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          page_url?: string | null
          user_id: string
        }
        Update: {
          action?: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          page_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      artifact_jobs: {
        Row: {
          artifact_type: string
          chat_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          html: string | null
          id: string
          model_used: string | null
          prompt: string
          status: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          artifact_type: string
          chat_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          html?: string | null
          id?: string
          model_used?: string | null
          prompt: string
          status?: string
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          artifact_type?: string
          chat_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          html?: string | null
          id?: string
          model_used?: string | null
          prompt?: string
          status?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifact_jobs_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          active: boolean
          amount_minor: number
          created_at: string
          credits_per_cycle: number
          currency: string
          cycle_days: number
          dodo_product_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_minor?: number
          created_at?: string
          credits_per_cycle?: number
          currency?: string
          cycle_days?: number
          dodo_product_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_minor?: number
          created_at?: string
          credits_per_cycle?: number
          currency?: string
          cycle_days?: number
          dodo_product_id?: string
          id?: string
          name?: string
          updated_at?: string
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
          artifact_html: string | null
          artifact_type: string | null
          chat_id: string
          content: string
          created_at: string
          credits_used: number | null
          id: string
          message_type: string
          new_balance: number | null
          role: string
          topic: string | null
        }
        Insert: {
          artifact_html?: string | null
          artifact_type?: string | null
          chat_id: string
          content: string
          created_at?: string
          credits_used?: number | null
          id?: string
          message_type?: string
          new_balance?: number | null
          role: string
          topic?: string | null
        }
        Update: {
          artifact_html?: string | null
          artifact_type?: string | null
          chat_id?: string
          content?: string
          created_at?: string
          credits_used?: number | null
          id?: string
          message_type?: string
          new_balance?: number | null
          role?: string
          topic?: string | null
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
      credit_transactions: {
        Row: {
          action: string
          created_at: string
          credits: number
          id: string
          metadata: Json
          payment_id: string | null
          product_id: string
          product_name: string
          source: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          credits: number
          id?: string
          metadata?: Json
          payment_id?: string | null
          product_id: string
          product_name: string
          source: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          credits?: number
          id?: string
          metadata?: Json
          payment_id?: string | null
          product_id?: string
          product_name?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      crisis_sessions: {
        Row: {
          id: string
          initiated_at: string
          last_updated: string
          notes: string | null
          state: string
          user_id: string
        }
        Insert: {
          id?: string
          initiated_at?: string
          last_updated?: string
          notes?: string | null
          state: string
          user_id: string
        }
        Update: {
          id?: string
          initiated_at?: string
          last_updated?: string
          notes?: string | null
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_memberships: {
        Row: {
          created_at: string
          current_period_end: string
          current_period_start: string
          customer_email: string
          customer_name: string | null
          grace_ends_at: string | null
          id: string
          last_invoice_id: string | null
          last_payment_id: string | null
          next_invoice_at: string | null
          plan_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          customer_email: string
          customer_name?: string | null
          grace_ends_at?: string | null
          id?: string
          last_invoice_id?: string | null
          last_payment_id?: string | null
          next_invoice_at?: string | null
          plan_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          customer_email?: string
          customer_name?: string | null
          grace_ends_at?: string | null
          id?: string
          last_invoice_id?: string | null
          last_payment_id?: string | null
          next_invoice_at?: string | null
          plan_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
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
      hot_cache: {
        Row: {
          answer: string
          board: string
          canonical_query: string
          feature: string
          generated_at: string
          hit_count: number
          id: string
          query_hash: string
        }
        Insert: {
          answer: string
          board?: string
          canonical_query: string
          feature: string
          generated_at?: string
          hit_count?: number
          id?: string
          query_hash: string
        }
        Update: {
          answer?: string
          board?: string
          canonical_query?: string
          feature?: string
          generated_at?: string
          hit_count?: number
          id?: string
          query_hash?: string
        }
        Relationships: []
      }
      lc_blocks: {
        Row: {
          block_type: string
          content_json: Json | null
          created_at: string
          error_text: string | null
          id: string
          model_used: string | null
          order_index: number
          parent_block_id: string | null
          project_id: string
          prompt_seed: string | null
          rendered_html: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          block_type: string
          content_json?: Json | null
          created_at?: string
          error_text?: string | null
          id?: string
          model_used?: string | null
          order_index?: number
          parent_block_id?: string | null
          project_id: string
          prompt_seed?: string | null
          rendered_html?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          block_type?: string
          content_json?: Json | null
          created_at?: string
          error_text?: string | null
          id?: string
          model_used?: string | null
          order_index?: number
          parent_block_id?: string | null
          project_id?: string
          prompt_seed?: string | null
          rendered_html?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lc_blocks_parent_block_id_fkey"
            columns: ["parent_block_id"]
            isOneToOne: false
            referencedRelation: "lc_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lc_blocks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "lc_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      lc_generation_log: {
        Row: {
          block_id: string | null
          created_at: string
          error_text: string | null
          id: string
          latency_ms: number | null
          model_id: string
          project_id: string | null
          role: string
          success: boolean
        }
        Insert: {
          block_id?: string | null
          created_at?: string
          error_text?: string | null
          id?: string
          latency_ms?: number | null
          model_id: string
          project_id?: string | null
          role: string
          success: boolean
        }
        Update: {
          block_id?: string | null
          created_at?: string
          error_text?: string | null
          id?: string
          latency_ms?: number | null
          model_id?: string
          project_id?: string | null
          role?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "lc_generation_log_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "lc_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lc_generation_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "lc_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      lc_model_cooldowns: {
        Row: {
          cooldown_until: string
          model_id: string
          reason: string | null
        }
        Insert: {
          cooldown_until: string
          model_id: string
          reason?: string | null
        }
        Update: {
          cooldown_until?: string
          model_id?: string
          reason?: string | null
        }
        Relationships: []
      }
      lc_model_routing: {
        Row: {
          fallback_model_ids: string[]
          notes: string | null
          primary_model_id: string
          role: string
          updated_at: string
        }
        Insert: {
          fallback_model_ids?: string[]
          notes?: string | null
          primary_model_id: string
          role: string
          updated_at?: string
        }
        Update: {
          fallback_model_ids?: string[]
          notes?: string | null
          primary_model_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      lc_projects: {
        Row: {
          created_at: string
          id: string
          output_type: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          output_type: string
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          output_type?: string
          status?: string
          title?: string
          updated_at?: string
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
      learning_progress: {
        Row: {
          category: string | null
          completed_at: string | null
          created_at: string
          credits_earned: number
          id: string
          interactions_count: number
          last_studied_at: string | null
          metadata: Json
          score: number | null
          status: string
          time_spent_seconds: number
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          credits_earned?: number
          id?: string
          interactions_count?: number
          last_studied_at?: string | null
          metadata?: Json
          score?: number | null
          status?: string
          time_spent_seconds?: number
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          credits_earned?: number
          id?: string
          interactions_count?: number
          last_studied_at?: string | null
          metadata?: Json
          score?: number | null
          status?: string
          time_spent_seconds?: number
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      lumina_sessions: {
        Row: {
          agent_logs: Json
          architecture_decisions: Json
          conversation_history: Json
          created_at: string
          id: string
          project_files: Json
          task_history: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_logs?: Json
          architecture_decisions?: Json
          conversation_history?: Json
          created_at?: string
          id?: string
          project_files?: Json
          task_history?: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_logs?: Json
          architecture_decisions?: Json
          conversation_history?: Json
          created_at?: string
          id?: string
          project_files?: Json
          task_history?: Json
          title?: string
          updated_at?: string
          user_id?: string
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
      recently_viewed: {
        Row: {
          content_id: string | null
          content_type: string
          id: string
          metadata: Json
          thumbnail_url: string | null
          title: string | null
          url: string | null
          user_id: string
          viewed_at: string
        }
        Insert: {
          content_id?: string | null
          content_type: string
          id?: string
          metadata?: Json
          thumbnail_url?: string | null
          title?: string | null
          url?: string | null
          user_id: string
          viewed_at?: string
        }
        Update: {
          content_id?: string | null
          content_type?: string
          id?: string
          metadata?: Json
          thumbnail_url?: string | null
          title?: string | null
          url?: string | null
          user_id?: string
          viewed_at?: string
        }
        Relationships: []
      }
      renewal_invoices: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          dodo_payment_id: string | null
          dodo_payment_link: string | null
          due_at: string
          id: string
          membership_id: string
          metadata: Json
          paid_at: string | null
          reminder_count: number
          status: string
          updated_at: string
        }
        Insert: {
          amount_minor?: number
          created_at?: string
          currency?: string
          dodo_payment_id?: string | null
          dodo_payment_link?: string | null
          due_at?: string
          id?: string
          membership_id: string
          metadata?: Json
          paid_at?: string | null
          reminder_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          dodo_payment_id?: string | null
          dodo_payment_link?: string | null
          due_at?: string
          id?: string
          membership_id?: string
          metadata?: Json
          paid_at?: string | null
          reminder_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewal_invoices_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "customer_memberships"
            referencedColumns: ["id"]
          },
        ]
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
      safety_events: {
        Row: {
          event_type: string
          feature: string | null
          id: string
          timestamp: string
          user_id: string
        }
        Insert: {
          event_type: string
          feature?: string | null
          id?: string
          timestamp?: string
          user_id: string
        }
        Update: {
          event_type?: string
          feature?: string | null
          id?: string
          timestamp?: string
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      thread_summaries: {
        Row: {
          created_at: string
          id: string
          messages_covered: number
          summary_text: string
          thread_id: string
          token_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages_covered: number
          summary_text: string
          thread_id: string
          token_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages_covered?: number
          summary_text?: string
          thread_id?: string
          token_count?: number | null
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
      user_connections: {
        Row: {
          access_token: string
          account_email: string | null
          account_label: string | null
          created_at: string
          id: string
          metadata: Json | null
          provider: string
          refresh_token: string | null
          scopes: string[] | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          account_email?: string | null
          account_label?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          provider: string
          refresh_token?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          account_email?: string | null
          account_label?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          provider?: string
          refresh_token?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_credit_balances: {
        Row: {
          balance: number
          created_at: string
          plan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          plan?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          plan?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      user_preferences: {
        Row: {
          created_at: string
          id: string
          language: string
          metadata: Json
          notifications_enabled: boolean
          preferred_model: string
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          language?: string
          metadata?: Json
          notifications_enabled?: boolean
          preferred_model?: string
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          metadata?: Json
          notifications_enabled?: boolean
          preferred_model?: string
          theme?: string
          updated_at?: string
          user_id?: string
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
      apply_dodo_credits: {
        Args: { _payment_id?: string; _product_id: string; _source?: string }
        Returns: {
          applied: boolean
          balance: number
          credits_added: number
          duplicate: boolean
          plan: string
          product_name: string
        }[]
      }
      apply_dodo_credits_for_user: {
        Args: {
          _payment_id?: string
          _product_id: string
          _source?: string
          _user_id: string
        }
        Returns: {
          applied: boolean
          balance: number
          credits_added: number
          duplicate: boolean
          plan: string
          product_name: string
        }[]
      }
      award_xp_coins: {
        Args: { p_coins: number; p_user_id: string; p_xp: number }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_dodo_credit_product: {
        Args: { _product_id: string }
        Returns: {
          credits: number
          plan_tier: string
          product_name: string
          product_type: string
        }[]
      }
      get_parent_link_by_code: {
        Args: { _code: string }
        Returns: {
          access_code: string
          id: string
          linked_at: string
          parent_email: string
          student_id: string
        }[]
      }
      get_usage_count: {
        Args: { p_feature: string; p_period_type?: string; p_user_id: string }
        Returns: number
      }
      has_active_billing_access: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      increment_study_minutes: {
        Args: { p_minutes: number; p_user_id: string }
        Returns: undefined
      }
      increment_usage: {
        Args: { p_feature: string; p_period_type?: string; p_user_id: string }
        Returns: number
      }
      lookup_squad_by_invite_code: {
        Args: { _code: string }
        Returns: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      spend_user_credits: {
        Args: { _action?: string; _amount: number }
        Returns: {
          balance: number
          success: boolean
        }[]
      }
      sync_dodo_entitlement_for_user: {
        Args: {
          _current_period_end?: string
          _payment_id?: string
          _product_id: string
          _source?: string
          _status?: string
          _subscription_id?: string
          _user_id: string
        }
        Returns: {
          applied: boolean
          balance: number
          credits_added: number
          duplicate: boolean
          plan: string
          product_name: string
          subscription_active: boolean
        }[]
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
