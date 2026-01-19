import { z } from 'zod';

// --- Domain Enums ---
export enum QueueStatus {
  GREEN = 'GREEN',   // 여유
  YELLOW = 'YELLOW', // 보통
  RED = 'RED'        // 혼잡
}

export enum TicketStatus {
  UNUSED = 'UNUSED',
  USED = 'USED',
  EXPIRED = 'EXPIRED'
}

export enum UserRole {
  STUDENT = 'STUDENT',
  ADMIN = 'ADMIN'
}

// --- Interfaces ---
export interface Restaurant {
  id: string;
  name: string;
  location: string;
  operatingHours: string;
  image: string; // Thumbnail for selection
  latitude: number; // For geolocation check
  longitude: number;
}

export interface MenuItem {
  id: string;
  restaurantId: string; // Linked to a specific restaurant
  name: string;
  price: number;
  imageUrl: string;
  isSoldOut: boolean;
  category: string;
  kcal: number;
}

export interface Ticket {
  id: string;
  restaurantId: string; // Added for validation
  restaurantName: string; 
  menuName: string;
  price: number;
  purchaseDate: string;
  status: TicketStatus;
  qrCodeData: string;
}

export interface QueueState {
  restaurantId: string;
  myQueueNumber: number | null; // Null if not in queue
  peopleAhead: number;
  estimatedWaitTimeMinutes: number;
  totalQueueSize: number;
  currentStatus: QueueStatus;
}

// --- Zod Schemas (As per PRD) ---
export const JoinQueueSchema = z.object({
  userId: z.string().uuid(),
  partySize: z.number().min(1, "최소 1명 이상이어야 합니다.").max(8, "최대 8명까지 가능합니다."),
  ticketId: z.string().optional(),
  isGroup: z.boolean().default(false),
});

export type JoinQueueInput = z.infer<typeof JoinQueueSchema>;

export const OrderSchema = z.object({
  menuId: z.string(),
  quantity: z.number().min(1).max(10),
});

export type OrderInput = z.infer<typeof OrderSchema>;