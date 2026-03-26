// types/invoice.ts
export interface InvoiceExtraction {
  vendor: string;
  seller_address: string | null;
  seller_email: string | null;
  seller_phone: string | null;
  category: string;
  invoice_number: string | null;
  order_number: string | null;
  invoice_date: string | null; // Changed from 'date' to match prompt and DB
  due_date: string | null; 
  payment_terms: string | null;
  payment_methods: string | null;
  currency: string | null;
  subtotal_amount: number | null; // Changed from 'subtotal'
  tax_amount: number | null;
  shipping_amount: number | null; // Changed from 'shipping'
  discount_amount: number | null; // Changed from 'discount'
  total_amount: number;
  service_address: string | null;
  items: Array<{
    description: string;
    qty: number;
    price: number;
    total: number; // Gemini returns 'total' for line items
  }>;
}