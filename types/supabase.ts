export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          avatar_url: string | null;
          age: number | null;
          bio: string | null;
          trust_score: number | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          name: string;
          avatar_url?: string | null;
          age?: number | null;
          bio?: string | null;
          trust_score?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          avatar_url?: string | null;
          age?: number | null;
          bio?: string | null;
          trust_score?: number | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      user_interests: {
        Row: {
          id: string;
          user_id: string;
          interest: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          interest: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          interest?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_interests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      venues: {
        Row: {
          id: string;
          name: string;
          address: string;
          lat: number;
          lng: number;
          location: unknown | null;
          type: "bar" | "club" | "pub" | "cafe" | null;
          opening_hours: Json | null;
          description: string | null;
          photo_url: string | null;
          active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          address: string;
          lat: number;
          lng: number;
          location?: unknown | null;
          type?: "bar" | "club" | "pub" | "cafe" | null;
          opening_hours?: Json | null;
          description?: string | null;
          photo_url?: string | null;
          active?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string;
          lat?: number;
          lng?: number;
          location?: unknown | null;
          type?: "bar" | "club" | "pub" | "cafe" | null;
          opening_hours?: Json | null;
          description?: string | null;
          photo_url?: string | null;
          active?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      user_favorites: {
        Row: {
          id: string;
          user_id: string;
          venue_id: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          venue_id: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          venue_id?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_favorites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_favorites_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          id: string;
          creator_id: string;
          venue_id: string | null;
          title: string;
          description: string | null;
          starts_at: string;
          max_attendees: number | null;
          status: "active" | "cancelled" | "finished" | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          creator_id: string;
          venue_id?: string | null;
          title: string;
          description?: string | null;
          starts_at: string;
          max_attendees?: number | null;
          status?: "active" | "cancelled" | "finished" | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          creator_id?: string;
          venue_id?: string | null;
          title?: string;
          description?: string | null;
          starts_at?: string;
          max_attendees?: number | null;
          status?: "active" | "cancelled" | "finished" | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "events_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      event_registrations: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          status: "pending" | "approved" | "rejected" | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          status?: "pending" | "approved" | "rejected" | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          status?: "pending" | "approved" | "rejected" | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_registrations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          showed_up: boolean | null;
          reported: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          showed_up?: boolean | null;
          reported?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          showed_up?: boolean | null;
          reported?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      night_venues: {
        Row: {
          id: string;
          event_id: string;
          venue_id: string;
          order: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          venue_id: string;
          order?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          venue_id?: string;
          order?: number | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "night_venues_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "night_venues_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      night_photos: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          photo_url: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          photo_url: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          photo_url?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "night_photos_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "night_photos_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// Handige afgeleiden types voor gebruik in de app
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type InsertDto<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type UpdateDto<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
