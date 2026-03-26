import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || "",
);

export async function scanInvoice(base64Image: string, fileType: string) {
  // Stick to the 2.5-flash model you specified
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
  SYSTEM: You are a professional OCR and Invoice Parsing engine. 
  TASK: Extract data from the provided image into a strict JSON format.

  EXTRACTION RULES:
  1. If a field is not present, return null. Do not guess or invent data.
  2. Numbers: "subtotal_amount", "tax_amount", "shipping_amount", "discount_amount", and "total_amount" must be numbers (float), not strings.
  3. Dates: All dates must be in "YYYY-MM-DD" format. 
  4. Items: "items" must be an array of objects. 
  5. Category: Choose exactly one: ["Mortgage or rent", "Food", "Transportation", "Utilities", "Subscriptions", "Personal expenses", "Savings and investments", "Debt or student loan payments", "Health care", "Miscellaneous expenses"].

  FIELD MAPPING GUIDE:
  - "vendor": The primary business name.
  - "seller_address": The address of the business selling the goods/service.
  - "seller_email": Any email found belonging to the seller.
  - "seller_phone": Any phone number for the seller.
  - "service_address": The "Ship To", "Service Location", or recipient's physical address.
  - "invoice_date": The main date the invoice was issued.
  - "due_date": The deadline for payment.
  - "payment_terms": e.g., "Net 30", "Due on Receipt".
  - "payment_methods": Mention of Visa, ACH, Check, PayPal, etc.

  OUTPUT JSON STRUCTURE (REQUIRED):
  {
    "vendor": "string",
    "seller_address": "string",
    "seller_email": "string",
    "seller_phone": "string",
    "invoice_number": "string",
    "order_number": "string",
    "category": "string",
    "invoice_date": "YYYY-MM-DD",
    "due_date": "YYYY-MM-DD",
    "service_address": "string",
    "payment_terms": "string",
    "payment_methods": "string",
    "currency": "string",
    "subtotal_amount": 0.00,
    "tax_amount": 0.00,
    "shipping_amount": 0.00,
    "discount_amount": 0.00,
    "total_amount": 0.00,
    "items": [
      { "description": "string", "qty": 0, "price": 0.00, "total": 0.00 }
    ]
  }

  NO PROSE. NO EXPLANATION. RETURN ONLY THE JSON OBJECT.
`;

  const fileData = {
    inlineData: {
      data: base64Image.includes(",") ? base64Image.split(",")[1] : base64Image,
      mimeType: fileType,
    },
  };

  try {
    const result = await model.generateContent([prompt, fileData]);
    const text = result.response.text();

    // Safety check: Remove markdown blocks if the AI includes them
    const cleanJson = text.replace(/```json|```/g, "").trim();
    return cleanJson;
  } catch (error) {
    console.error("Gemini_Extraction_Critical_Failure:", error);
    throw new Error(
      "Unable to parse document. Check API Key or Image Clarity.",
    );
  }
}
