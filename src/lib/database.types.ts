import type { AccountGroup } from "@/components/accounting-data";

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
      accounts: {
        Row: {
          id: string;
          code: string;
          name: string;
          account_type: AccountGroup;
          normal_balance: "debit" | "credit";
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          account_type: AccountGroup;
          normal_balance: "debit" | "credit";
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          code?: string;
          name?: string;
          account_type?: AccountGroup;
          normal_balance?: "debit" | "credit";
          is_active?: boolean;
        };
        Relationships: [];
      };
      journal_entries: {
        Row: {
          id: string;
          entry_number: string;
          entry_date: string;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          entry_number: string;
          entry_date: string;
          description: string;
          created_at?: string;
        };
        Update: {
          entry_number?: string;
          entry_date?: string;
          description?: string;
        };
        Relationships: [];
      };
      journal_lines: {
        Row: {
          id: string;
          journal_entry_id: string;
          line_number: number;
          account_id: string;
          debit: number;
          credit: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          journal_entry_id: string;
          line_number: number;
          account_id: string;
          debit?: number;
          credit?: number;
          created_at?: string;
        };
        Update: {
          line_number?: number;
          account_id?: string;
          debit?: number;
          credit?: number;
        };
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey";
            columns: ["journal_entry_id"];
            isOneToOne: false;
            referencedRelation: "journal_entries";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      post_journal_entry: {
        Args: {
          p_entry_date: string;
          p_description: string;
          p_lines: Json;
        };
        Returns: {
          id: string;
          entry_number: string;
          entry_date: string;
          description: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
