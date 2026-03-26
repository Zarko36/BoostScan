// types/invoice.ts
export interface InvoiceExtraction {
  vendor: string;
  seller_address?: string;
  seller_email?: string;
  seller_phone?: string;
  category: string;
  invoice_number?: string;
  order_number?: string;
  invoice_date?: string; 
  due_date?: string; 
  payment_terms?: string;
  payment_methods?: string;
  currency?: string;
  subtotal?: number;
  tax_amount?: number;
  shipping?: number;
  discount?: number;
  total_amount: number;
  service_address?: string;
  items: Array<{
    description: string;
    qty: number;
    price: number;
    total_amount: number;
  }>;
}