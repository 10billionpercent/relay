export interface Message {
  id: string;
  role: string;
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
}

export interface Model {
  provider: string;
  model: string;
}

export interface UserData {
  id: string;
  username: string;
}