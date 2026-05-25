export interface RegistroCredito {
  id: number;
  data: string;       // "2010-01-01 00:00:00"
  estado: string;     
  regiao: string;     
  tipo: string;       
  valor: number;
}

export interface ResumoEstado {
  estado: string;     
  regiao: string;     
  total: number;      
  media: number;      
}

export interface SerieHistorica {
  data: string;       // "2010-01-01 00:00:00"
  valor: number;
}

export interface RegistroHistorico {
  data: string;
  saldo: number;
  inadimplencia: number;
  variacao: number;
}

export interface ItemRanking {
  estado: string;  // nome completo do estado, ex: "São Paulo"
  uf: string;      // sigla, ex: "SP"
  regiao: string;
  score: number;   // 0–100
  posicao: number;
}

export type TipoIndicador = "saldo" | "inadimplencia" | "variacao";

export type Regiao = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";


export interface UsuarioRegistro {
  nome: string;
  email: string;
  senha: string;
}

export interface UsuarioLogin {
  email: string;
  senha: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  usuario: {
    id: number;
    nome: string;
    email: string;
    perfil: "analista" | "gestor";
  };
}


export type FormatoRelatorio = "pdf" | "excel";

export interface RelatorioParams {
  formato: FormatoRelatorio;
  estado?: string;  
  mes?: number;    
  ano?: number;
}