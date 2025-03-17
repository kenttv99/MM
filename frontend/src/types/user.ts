// src/types/user.ts
export interface UserResponse {
    id: number;
    fio: string;
    email: string;
    telegram: string;
    whatsapp: string;
    avatar_url?: string; // Опционально, так как в схеме nullable
  }