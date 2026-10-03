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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      authorized_emails: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      recursos_reserva: {
        Row: {
          ativo: boolean
          categoria: Database["public"]["Enums"]["resource_category"]
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: Database["public"]["Enums"]["resource_category"]
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["resource_category"]
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      reservas: {
        Row: {
          canceled_at: string | null
          canceled_by: string | null
          created_at: string
          created_by: string
          finalidade: string
          fim: string
          id: string
          inicio: string
          recurso_id: string
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          created_by: string
          finalidade: string
          fim: string
          id?: string
          inicio: string
          recurso_id: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          created_by?: string
          finalidade?: string
          fim?: string
          id?: string
          inicio?: string
          recurso_id?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservas_recurso_id_fkey"
            columns: ["recurso_id"]
            isOneToOne: false
            referencedRelation: "recursos_reserva"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_responsibles: {
        Row: {
          id: string
          sector_id: string
          user_id: string
        }
        Insert: {
          id?: string
          sector_id: string
          user_id: string
        }
        Update: {
          id?: string
          sector_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_responsibles_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      solicitacao_decisoes: {
        Row: {
          comentario: string | null
          created_at: string
          decidido_por: string
          decisao: Database["public"]["Enums"]["request_status"]
          id: string
          solicitacao_id: string
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          decidido_por: string
          decisao: Database["public"]["Enums"]["request_status"]
          id?: string
          solicitacao_id: string
        }
        Update: {
          comentario?: string | null
          created_at?: string
          decidido_por?: string
          decisao?: Database["public"]["Enums"]["request_status"]
          id?: string
          solicitacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacao_decisoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes: {
        Row: {
          attachment_paths: string[]
          created_at: string
          created_by: string
          decided_at: string | null
          detalhes: Json
          id: string
          status: Database["public"]["Enums"]["request_status"]
          tipo: Database["public"]["Enums"]["request_type"]
          titulo: string
          updated_at: string
        }
        Insert: {
          attachment_paths?: string[]
          created_at?: string
          created_by: string
          decided_at?: string | null
          detalhes?: Json
          id?: string
          status?: Database["public"]["Enums"]["request_status"]
          tipo: Database["public"]["Enums"]["request_type"]
          titulo: string
          updated_at?: string
        }
        Update: {
          attachment_paths?: string[]
          created_at?: string
          created_by?: string
          decided_at?: string | null
          detalhes?: Json
          id?: string
          status?: Database["public"]["Enums"]["request_status"]
          tipo?: Database["public"]["Enums"]["request_type"]
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          photo_path: string | null
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          photo_path?: string | null
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          photo_path?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_history: {
        Row: {
          actor_id: string | null
          created_at: string
          details: Json | null
          event: string
          id: string
          ticket_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          event: string
          id?: string
          ticket_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          event?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          location: string | null
          photo_paths: string[]
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          sector_id: string
          solution_comment: string | null
          solution_photo: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          id?: string
          location?: string | null
          photo_paths?: string[]
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          sector_id: string
          solution_comment?: string | null
          solution_photo?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          location?: string | null
          photo_paths?: string[]
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          sector_id?: string
          solution_comment?: string | null
          solution_photo?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_ticket: {
        Args: { _ticket_id: string; _user_id: string }
        Returns: boolean
      }
      decidir_solicitacao: {
        Args: {
          _comentario?: string
          _decisao: Database["public"]["Enums"]["request_status"]
          _solicitacao_id: string
        }
        Returns: {
          comentario: string | null
          created_at: string
          decidido_por: string
          decisao: Database["public"]["Enums"]["request_status"]
          id: string
          solicitacao_id: string
        }
        SetofOptions: {
          from: "*"
          to: "solicitacao_decisoes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancelar_reserva: {
        Args: { _reserva_id: string }
        Returns: Database["public"]["Tables"]["reservas"]["Row"]
        SetofOptions: { from: "*"; to: "reservas"; isOneToOne: true; isSetofReturn: false }
      }
      criar_reservas: {
        Args: { _fim: string; _finalidade: string; _inicio: string; _ocorrencias?: number; _recurso_id: string }
        Returns: Database["public"]["Tables"]["reservas"]["Row"]
        SetofOptions: { from: "*"; to: "reservas"; isOneToOne: false; isSetofReturn: true }
      }
      listar_reservas: {
        Args: { _fim: string; _inicio: string }
        Returns: {
          id: string
          recurso_id: string
          created_by: string
          inicio: string
          fim: string
          finalidade: string
          status: Database["public"]["Enums"]["reservation_status"]
          created_at: string
          reservante_nome: string
        }[]
        SetofOptions: { from: "*"; to: null; isOneToOne: false; isSetofReturn: true }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_authorized_user: {
        Args: { _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "direcao" | "responsavel" | "colaborador"
      request_status: "pendente" | "aprovada" | "negada" | "cancelada"
      reservation_status: "ativa" | "cancelada"
      resource_category: "espaco" | "equipamento"
      request_type:
        | "material"
        | "copias"
        | "compra"
        | "saida_antecipada"
        | "verba_evento"
      ticket_priority: "normal" | "urgente"
      ticket_status: "aberto" | "em_andamento" | "resolvido"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "direcao", "responsavel", "colaborador"],
      request_status: ["pendente", "aprovada", "negada", "cancelada"],
      request_type: [
        "material",
        "copias",
        "compra",
        "saida_antecipada",
        "verba_evento",
      ],
      ticket_priority: ["normal", "urgente"],
      ticket_status: ["aberto", "em_andamento", "resolvido"],
    },
  },
} as const
