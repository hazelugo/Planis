// AUTO-GENERATED — do not edit manually
// Regenerate with: npm run gen:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      trips: {
        Row: {
          id: string
          data: Json
          updated_at: string
          owner_id: string | null
        }
        Insert: {
          id?: string
          data?: Json
          updated_at?: string
          owner_id?: string | null
        }
        Update: {
          id?: string
          data?: Json
          updated_at?: string
          owner_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
