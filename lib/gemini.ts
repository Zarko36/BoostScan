// import { GoogleGenerativeAI } from "@google/generative-ai";

// const genAI = new GoogleGenerativeAI(
//   process.env.NEXT_PUBLIC_GEMINI_API_KEY || "",
// );

// export async function scanInvoice(base64Image: string, fileType: string) {
//   // Reverted to your original model version
//   const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

//   const prompt = `
//     ACT AS A PROFESSIONAL AUDITOR. ANALYZE THE ATTACHED DOCUMENT AND RETURN A STRICT JSON OBJECT.

//     CORE GOAL: Extract data into the schema below regardless of the original document's layout or terminology.

//     EXTRACTION GUIDELINES:
//     1. "vendor": The primary business name (e.g., ECCPP AutoParts Store).
//     2. "category": Select exactly one: "Mortgage or rent", "Food", "Transportation", "Utilities", "Subscriptions", "Personal expenses", "Savings and investments", "Debt or student loan payments", "Health care", or "Miscellaneous expenses".
//     3. "order_number": Any unique identifier like Order #, Invoice ID, or Ref # (e.g., E191109740).
//     4. "service_address": The physical location of service or the "Shipping Info" address (e.g., 6411 Siamese Place).
//     5. "items": Include EVERY line item, tax, shipping, and discount.
//        - For any "Discount" or "OFF" amount (e.g., -$5.00), you MUST include it as an item with a negative price.

//     STRICT JSON SCHEMA:
//     {
//       "vendor": "string",
//       "date": "YYYY-MM-DD",
//       "total": number,
//       "category": "string",
//       "order_number": "string",
//       "service_address": "string",
//       "items": [{ "description": "string", "qty": number, "price": number }]
//     }
//   `;

//   const fileData = {
//     inlineData: {
//       data: base64Image.includes(",") ? base64Image.split(",")[1] : base64Image,
//       mimeType: fileType,
//     },
//   };

//   try {
//     const result = await model.generateContent([prompt, fileData]);
//     const text = result.response.text();
//     // Clean potential markdown formatting from the AI response
//     return text.replace(/```json|```/g, "").trim();
//   } catch (error) {
//     console.error("Scan Error:", error);
//     throw new Error(
//       "Failed to parse document. Please ensure the file is clear.",
//     );
//   }
// }

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || "",
);

export async function scanInvoice(base64Image: string, fileType: string) {
  // Stick to the 2.5-flash model you specified
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    SYSTEM: ACT AS AN EXPERT DATA EXTRACTOR. 
    TASK: ANALYZE THE IMAGE AND OUTPUT ONLY A JSON OBJECT. NO PROSE. NO EXPLANATIONS.

    CRITICAL SEARCH FOR "order_number":
    - Many invoices for auto parts use "Ref", "Invoice #", or "PO Number".
    - If you see a string like "E1911..." or any long alphanumeric code near the top, that is the order_number.
    - DO NOT skip this field. If you see any reference ID, put it here.

    FIELD DEFINITIONS:
    1. "vendor": Business name (e.g. SubaruPartsDirect, ECCPP).
    2. "category": Must be one of ["Mortgage or rent", "Food", "Transportation", "Utilities", "Subscriptions", "Personal expenses", "Savings and investments", "Debt or student loan payments", "Health care", "Miscellaneous expenses"].
    3. "order_number": String. Look for Order ID, Ref, or Invoice ID.
    4. "service_address": String. Shipping or service location.
    5. "items": Array of { "description": string, "qty": number|string, "price": number }.
    
    OUTPUT FORMAT:
    {
      "vendor": "string",
      "date": "YYYY-MM-DD",
      "total": number,
      "category": "string",
      "order_number": "string",
      "service_address": "string",
      "items": []
    }
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
