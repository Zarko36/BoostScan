import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || "",
);

export async function scanInvoice(base64Image: string, fileType: string) {
  // Stick to the 2.5-flash model you specified
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    SYSTEM: ACT AS AN EXPERT DATA EXTRACTOR. 
    TASK: ANALYZE THE INVOICE IMAGE AND OUTPUT ONLY A JSON OBJECT. NO PROSE. NO EXPLANATIONS.

    CRITICAL SEARCH:
    - "vendor": The main business or seller name.
    - "seller_info": Extract the business address, email, and phone number.
    - "invoice_number": Look for "Invoice #", "Inv No.", or "Billing ID".
    - "order_number": Look for "Ref", "PO Number", or "Order ID".
    - "financials": Separate the subtotal, tax, shipping, and any discounts.
    - "dates": Distinguish between "Invoice/Issue Date" and the "Due Date".

    FIELD DEFINITIONS & MAPPING:
    1. "vendor": Business name.
    2. "seller_address": Full physical address of the seller.
    3. "seller_email": Business email address found in header/footer.
    4. "seller_phone": Business phone number.
    5. "category": Strictly one of ["Mortgage or rent", "Food", "Transportation", "Utilities", "Subscriptions", "Personal expenses", "Savings and investments", "Debt or student loan payments", "Health care", "Miscellaneous expenses"].
    6. "invoice_number": The unique billing identifier.
    7. "order_number": The transaction or reference ID.
    8. "service_address": The "Ship To" or location where service was provided.
    9. "payment_terms": e.g., "Net 30", "Due on Receipt", "Paid".
    10. "payment_methods": Extracted bank/payment info (ACH, PayPal, etc).
    11. "currency": 3-letter code (e.g., "USD"). Default to "USD".
    12. "items": Array of { "description": string, "qty": number, "price": number, "total": number }.

    OUTPUT FORMAT:
    {
      "vendor": "string",
      "seller_address": "string",
      "seller_email": "string",
      "seller_phone": "string",
      "invoice_number": "string",
      "order_number": "string",
      "category": "string",
      "date": "YYYY-MM-DD",
      "due_date": "YYYY-MM-DD",
      "payment_terms": "string",
      "payment_methods": "string",
      "currency": "string",
      "subtotal": number,
      "tax": number,
      "shipping": number,
      "discount": number,
      "total": number,
      "service_address": "string",
      "items": []
    }
  `;

  // const prompt = `
  //   SYSTEM: ACT AS AN EXPERT DATA EXTRACTOR. 
  //   TASK: ANALYZE THE IMAGE AND OUTPUT ONLY A JSON OBJECT. NO PROSE. NO EXPLANATIONS.

  //   CRITICAL SEARCH:
  //   - "order_number": Look for Ref, Invoice #, or PO Number.
  //   - "financials": Separate the subtotal, tax, shipping, and any discounts.

  //   FIELD DEFINITIONS:
  //   1. "vendor": Business name.
  //   2. "category": One of ["Mortgage or rent", "Food", "Transportation", "Utilities", "Subscriptions", "Personal expenses", "Savings and investments", "Debt or student loan payments", "Health care", "Miscellaneous expenses"].
  //   3. "order_number": String. Look for Order ID, Ref, or Invoice ID.
  //   4. "service_address": String. Shipping or service location.
  //   5. "tax": Number. Extract sales tax or VAT. Default to 0.
  //   6. "shipping": Number. Extract shipping/handling fees. Default to 0.
  //   7. "discount": Number. Extract any applied discounts or coupons. Default to 0.
  //   8. "items": Array of { "description": string, "qty": number|string, "price": number }.
    
  //   OUTPUT FORMAT:
  //   {
  //     "vendor": "string",
  //     "date": "YYYY-MM-DD",
  //     "total": number,
  //     "tax": number,
  //     "shipping": number,
  //     "discount": number,
  //     "category": "string",
  //     "order_number": "string",
  //     "service_address": "string",
  //     "items": []
  //   }
  // `;

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
