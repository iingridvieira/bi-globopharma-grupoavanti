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
      access_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          nome: string
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          observacao: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          observacao?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          observacao?: string | null
        }
        Relationships: []
      }
      consolidado_overrides: {
        Row: {
          ano: number
          campo: string
          id: string
          mes: number
          updated_at: string
          updated_by: string | null
          valor: number
        }
        Insert: {
          ano: number
          campo: string
          id?: string
          mes: number
          updated_at?: string
          updated_by?: string | null
          valor?: number
        }
        Update: {
          ano?: number
          campo?: string
          id?: string
          mes?: number
          updated_at?: string
          updated_by?: string | null
          valor?: number
        }
        Relationships: []
      }
      conta_corrente_arquivos: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      crm_cliente_representadas: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          representada_id: string
          user_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          representada_id: string
          user_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          representada_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_cliente_representadas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "crm_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cliente_representadas_representada_id_fkey"
            columns: ["representada_id"]
            isOneToOne: false
            referencedRelation: "crm_representadas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_clientes: {
        Row: {
          created_at: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_compras: {
        Row: {
          cliente_representada_id: string
          created_at: string
          data_compra: string
          id: string
          user_id: string
        }
        Insert: {
          cliente_representada_id: string
          created_at?: string
          data_compra: string
          id?: string
          user_id: string
        }
        Update: {
          cliente_representada_id?: string
          created_at?: string
          data_compra?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_compras_cliente_representada_id_fkey"
            columns: ["cliente_representada_id"]
            isOneToOne: false
            referencedRelation: "crm_cliente_representadas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_representadas: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          nome: string
          ordem: number
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          nome: string
          ordem?: number
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          nome?: string
          ordem?: number
          slug?: string
        }
        Relationships: []
      }
      crm_status_mensal: {
        Row: {
          cliente_representada_id: string
          created_at: string
          id: string
          mes_ref: string
          motivo_nao_compra: string | null
          observacoes: string | null
          status: Database["public"]["Enums"]["crm_cliente_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cliente_representada_id: string
          created_at?: string
          id?: string
          mes_ref: string
          motivo_nao_compra?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["crm_cliente_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cliente_representada_id?: string
          created_at?: string
          id?: string
          mes_ref?: string
          motivo_nao_compra?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["crm_cliente_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_status_mensal_cliente_representada_id_fkey"
            columns: ["cliente_representada_id"]
            isOneToOne: false
            referencedRelation: "crm_cliente_representadas"
            referencedColumns: ["id"]
          },
        ]
      }
      descricoes_sell_in: {
        Row: {
          cliente_id: string | null
          created_at: string
          created_by: string | null
          id: string
          texto: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          texto?: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          texto?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      imec_clientes: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      imec_investimento_nf: {
        Row: {
          created_at: string
          data_cobranca: string | null
          data_pagamento: string | null
          id: string
          nota_fiscal_id: string
          observacao: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_cobranca?: string | null
          data_pagamento?: string | null
          id?: string
          nota_fiscal_id: string
          observacao?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_cobranca?: string | null
          data_pagamento?: string | null
          id?: string
          nota_fiscal_id?: string
          observacao?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "imec_investimento_nf_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: true
            referencedRelation: "imec_notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      imec_investimento_precos: {
        Row: {
          ativo: boolean
          created_at: string
          ean: string
          id: string
          preco_custo: number
          preco_final: number
          produto: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          ean: string
          id?: string
          preco_custo?: number
          preco_final?: number
          produto: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          ean?: string
          id?: string
          preco_custo?: number
          preco_final?: number
          produto?: string
          updated_at?: string
        }
        Relationships: []
      }
      imec_itens_nf: {
        Row: {
          codigo_produto: string | null
          created_at: string
          ean: string | null
          id: string
          nota_fiscal_id: string
          produto: string
          quantidade: number
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          codigo_produto?: string | null
          created_at?: string
          ean?: string | null
          id?: string
          nota_fiscal_id: string
          produto: string
          quantidade?: number
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          codigo_produto?: string | null
          created_at?: string
          ean?: string | null
          id?: string
          nota_fiscal_id?: string
          produto?: string
          quantidade?: number
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "imec_itens_nf_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "imec_notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      imec_notas_fiscais: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          data: string
          empresa: string
          id: string
          numero: string
          observacao: string | null
          razao_social: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data: string
          empresa?: string
          id?: string
          numero: string
          observacao?: string | null
          razao_social?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data?: string
          empresa?: string
          id?: string
          numero?: string
          observacao?: string | null
          razao_social?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "imec_notas_fiscais_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "imec_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      imec_pedido_itens: {
        Row: {
          created_at: string
          descricao: string
          ean: string | null
          id: string
          pedido_id: string
          preco_passado: number
          quantidade: number
        }
        Insert: {
          created_at?: string
          descricao: string
          ean?: string | null
          id?: string
          pedido_id: string
          preco_passado?: number
          quantidade?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          ean?: string | null
          id?: string
          pedido_id?: string
          preco_passado?: number
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "imec_pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "imec_pedidos_enviados"
            referencedColumns: ["id"]
          },
        ]
      }
      imec_pedidos_enviados: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          data: string
          empresa: string
          id: string
          valor: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data: string
          empresa?: string
          id?: string
          valor?: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data?: string
          empresa?: string
          id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "imec_pedidos_enviados_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "imec_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      imec_produtos: {
        Row: {
          ativo: boolean
          codigo_interno: string
          created_at: string
          ean: string
          id: string
          produto: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo_interno: string
          created_at?: string
          ean: string
          id?: string
          produto: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo_interno?: string
          created_at?: string
          ean?: string
          id?: string
          produto?: string
          updated_at?: string
        }
        Relationships: []
      }
      imec_sell_in: {
        Row: {
          ano: number
          cliente_id: string
          created_at: string
          empresa: string
          id: string
          mes: number
          updated_at: string
          valor: number
        }
        Insert: {
          ano: number
          cliente_id: string
          created_at?: string
          empresa?: string
          id?: string
          mes: number
          updated_at?: string
          valor?: number
        }
        Update: {
          ano?: number
          cliente_id?: string
          created_at?: string
          empresa?: string
          id?: string
          mes?: number
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "imec_sell_in_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "imec_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_nf: {
        Row: {
          codigo_produto: string | null
          desconto: number
          ean: string | null
          id: string
          nota_fiscal_id: string
          produto: string
          quantidade: number
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          codigo_produto?: string | null
          desconto?: number
          ean?: string | null
          id?: string
          nota_fiscal_id: string
          produto: string
          quantidade?: number
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          codigo_produto?: string | null
          desconto?: number
          ean?: string | null
          id?: string
          nota_fiscal_id?: string
          produto?: string
          quantidade?: number
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_nf_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      mapas_vendas_arquivos: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mapas_vendas_arquivos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_globo: {
        Row: {
          ano: number
          id: string
          mes: number
          updated_at: string
          updated_by: string | null
          valor: number
        }
        Insert: {
          ano: number
          id?: string
          mes: number
          updated_at?: string
          updated_by?: string | null
          valor?: number
        }
        Update: {
          ano?: number
          id?: string
          mes?: number
          updated_at?: string
          updated_by?: string | null
          valor?: number
        }
        Relationships: []
      }
      metas_mensais: {
        Row: {
          ano: number
          cliente_id: string
          created_at: string
          id: string
          mes: number
          pendencia_inicial: number
          valor: number
        }
        Insert: {
          ano: number
          cliente_id: string
          created_at?: string
          id?: string
          mes: number
          pendencia_inicial?: number
          valor?: number
        }
        Update: {
          ano?: number
          cliente_id?: string
          created_at?: string
          id?: string
          mes?: number
          pendencia_inicial?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "metas_mensais_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      nf_entregas: {
        Row: {
          created_at: string
          data_agendamento: string | null
          data_entrega: string | null
          id: string
          numero: string
          observacao: string | null
          previsao_entrega: string | null
          status: string
          transportadora: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          data_agendamento?: string | null
          data_entrega?: string | null
          id?: string
          numero: string
          observacao?: string | null
          previsao_entrega?: string | null
          status?: string
          transportadora?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          data_agendamento?: string | null
          data_entrega?: string | null
          id?: string
          numero?: string
          observacao?: string | null
          previsao_entrega?: string | null
          status?: string
          transportadora?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      nf_entregas_importacoes: {
        Row: {
          arquivo: string | null
          atualizadas: number
          created_at: string
          created_by: string | null
          id: string
          novas: number
          total_linhas: number
        }
        Insert: {
          arquivo?: string | null
          atualizadas?: number
          created_at?: string
          created_by?: string | null
          id?: string
          novas?: number
          total_linhas?: number
        }
        Update: {
          arquivo?: string | null
          atualizadas?: number
          created_at?: string
          created_by?: string | null
          id?: string
          novas?: number
          total_linhas?: number
        }
        Relationships: []
      }
      notas_fiscais: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          data: string
          desconto: number
          id: string
          numero: string
          observacao: string | null
          razao_social: string | null
          valor: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data: string
          desconto?: number
          id?: string
          numero: string
          observacao?: string | null
          razao_social?: string | null
          valor: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data?: string
          desconto?: number
          id?: string
          numero?: string
          observacao?: string | null
          razao_social?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string
          ean: string | null
          id: string
          pedido_id: string
          preco_passado: number
          quantidade: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao: string
          ean?: string | null
          id?: string
          pedido_id: string
          preco_passado?: number
          quantidade?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string
          ean?: string | null
          id?: string
          pedido_id?: string
          preco_passado?: number
          quantidade?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_enviados"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_enviados: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          data: string
          id: string
          ordem_compra: string | null
          prazo: string | null
          status: string
          valor: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data: string
          id?: string
          ordem_compra?: string | null
          prazo?: string | null
          status?: string
          valor: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          ordem_compra?: string | null
          prazo?: string | null
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_enviados_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pendencias: {
        Row: {
          ano: number
          cliente_id: string
          created_at: string
          id: string
          mes: number
          updated_at: string
          valor: number
        }
        Insert: {
          ano: number
          cliente_id: string
          created_at?: string
          id?: string
          mes: number
          updated_at?: string
          valor?: number
        }
        Update: {
          ano?: number
          cliente_id?: string
          created_at?: string
          id?: string
          mes?: number
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pendencias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pendencias_anteriores_produtos: {
        Row: {
          ano: number
          cliente_id: string
          codigo_produto: string | null
          created_at: string
          data_lancamento: string | null
          ean: string | null
          id: string
          mes: number
          preco_unitario: number
          produto: string
          quantidade: number
          valor: number
        }
        Insert: {
          ano: number
          cliente_id: string
          codigo_produto?: string | null
          created_at?: string
          data_lancamento?: string | null
          ean?: string | null
          id?: string
          mes: number
          preco_unitario?: number
          produto?: string
          quantidade?: number
          valor?: number
        }
        Update: {
          ano?: number
          cliente_id?: string
          codigo_produto?: string | null
          created_at?: string
          data_lancamento?: string | null
          ean?: string | null
          id?: string
          mes?: number
          preco_unitario?: number
          produto?: string
          quantidade?: number
          valor?: number
        }
        Relationships: []
      }
      pendencias_produtos: {
        Row: {
          cliente_id: string
          codigo_produto: string | null
          created_at: string
          data_lancamento: string | null
          ean: string | null
          id: string
          operacao: string | null
          preco_unitario: number
          produto: string
          quantidade: number
          valor: number
        }
        Insert: {
          cliente_id: string
          codigo_produto?: string | null
          created_at?: string
          data_lancamento?: string | null
          ean?: string | null
          id?: string
          operacao?: string | null
          preco_unitario?: number
          produto?: string
          quantidade?: number
          valor?: number
        }
        Update: {
          cliente_id?: string
          codigo_produto?: string | null
          created_at?: string
          data_lancamento?: string | null
          ean?: string | null
          id?: string
          operacao?: string | null
          preco_unitario?: number
          produto?: string
          quantidade?: number
          valor?: number
        }
        Relationships: []
      }
      positivacao: {
        Row: {
          ano: number
          cliente_id: string
          created_at: string
          id: string
          mes: number
          positivacao_globo: number
          positivacao_total: number
          updated_at: string
        }
        Insert: {
          ano: number
          cliente_id: string
          created_at?: string
          id?: string
          mes: number
          positivacao_globo?: number
          positivacao_total?: number
          updated_at?: string
        }
        Update: {
          ano?: number
          cliente_id?: string
          created_at?: string
          id?: string
          mes?: number
          positivacao_globo?: number
          positivacao_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positivacao_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          username?: string | null
        }
        Relationships: []
      }
      sell_in: {
        Row: {
          ano: number
          cliente_id: string
          created_at: string
          id: string
          mes: number
          valor: number
        }
        Insert: {
          ano: number
          cliente_id: string
          created_at?: string
          id?: string
          mes: number
          valor?: number
        }
        Update: {
          ano?: number
          cliente_id?: string
          created_at?: string
          id?: string
          mes?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "sell_in_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      sell_out: {
        Row: {
          ano: number
          cliente_id: string
          created_at: string
          id: string
          mes: number
          valor: number
        }
        Insert: {
          ano: number
          cliente_id: string
          created_at?: string
          id?: string
          mes: number
          valor?: number
        }
        Update: {
          ano?: number
          cliente_id?: string
          created_at?: string
          id?: string
          mes?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "sell_out_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      crm_backfill_pedidos_globo: { Args: never; Returns: number }
      crm_backfill_pedidos_imec: { Args: never; Returns: number }
      crm_sync_pedido: {
        Args: {
          p_cliente_nome: string
          p_data: string
          p_representada_slug?: string
          p_status: string
          p_user_id: string
        }
        Returns: undefined
      }
      get_email_for_username: { Args: { _username: string }; Returns: string }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      imec_calc_investimento_nf: {
        Args: { p_nota_fiscal_id: string }
        Returns: number
      }
      imec_investimento_recheck_recentes: { Args: never; Returns: number }
      imec_match_produto: {
        Args: { p_descricao: string }
        Returns: { codigo_interno: string; ean: string }[]
      }
      imec_normalize_produto: { Args: { s: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "representante" | "viewer" | "editor"
      crm_cliente_status: "comprou" | "negociacao" | "nao_comprou" | "inativo"
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
      app_role: ["admin", "representante", "viewer", "editor"],
      crm_cliente_status: ["comprou", "negociacao", "nao_comprou", "inativo"],
    },
  },
} as const
