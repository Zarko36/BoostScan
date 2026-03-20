import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

export async function scanInvoice(base64Image: string, fileType: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    Analyze this invoice with high precision. 
    Extract the following sections and format them as a professional technical report:

    1. CUSTOMER & SHIPPING:
      - Full Name
      - Shipping Address (Street, City, State, Zip)
      - Order Number

    2. LINE ITEMS TABLE:
      - Create a Markdown table with: [Item Description] | [SKU] | [Qty] | [Price] | [Total]

    3. FINANCIAL SUMMARY:
      - Subtotal
      - Discounts (specify the type, e.g., '$5 OFF ON $129')
      - Shipping & Handling
      - Grand Total

    4. VENDOR INFO:
      - Vendor Name
      - Contact Email/Support Link

    If any field is missing, simply label it as 'NOT_FOUND'. 
    Maintain a clean, monospaced aesthetic in the output.
  `;

  const fileData = {
    inlineData: {
      data: base64Image.includes(",") ? base64Image.split(",")[1] : base64Image,
      // This dynamically sets the type (image/png, application/pdf, etc.)
      mimeType: fileType, 
    },
  };

  try {
    const result = await model.generateContent([prompt, fileData]);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Scan failed. Google is likely warming up your quota. Try again in 1 minute.";
  }
}