
import Dexie, { Table } from 'dexie';

export interface LocalProduct {
  id: string; // SKU or Name
  name: string;
  category: string;
  price: number;
  stock: number;
  image?: string;
  updatedAt: number; // For sync validity
}

export interface PendingTransaction {
  id?: number; // Auto-increment key
  type: 'INBOUND' | 'OUTBOUND' | 'ADJUST' | 'DAMAGE' | 'RECEIVING' | 'CYCLE_COUNT' | 'ORDER' | 'RETURN';
  data: any; // The payload we would have sent to the API
  endpoint?: string;
  method?: 'POST' | 'PATCH' | 'PUT';
  timestamp: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
  retryCount: number;
}

export class WMSDatabase extends Dexie {
  products!: Table<LocalProduct>;
  pendingTransactions!: Table<PendingTransaction>;

  constructor() {
    super('WMS_DB_Professional');
    
    // Define Schema
    // ++id means auto-incrementing integer key
    this.version(1).stores({
      products: 'id, category, updatedAt', // Index by id, category
      pendingTransactions: '++id, status, timestamp'
    });
  }
}

export const db = new WMSDatabase();
