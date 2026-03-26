import puppeteer from 'puppeteer';

// --- THE CATEGORY ENGINE ---
// Each category now has its own "Business Persona" to ensure high-quality test data.
const invoiceData = {
  "Mortgage or rent": {
    seller: { name: "Heritage Property Management", addr: "400 Skyline Blvd, Riverside, CA", phone: "951-555-0102", email: "billing@heritagepm.com" },
    terms: "Due on Receipt",
    items: [{ desc: "Monthly Residential Rent - Unit 402", qty: 1, rate: 2150 }]
  },
  "Food": {
    seller: { name: "Gourmet Garden Grocers", addr: "1202 Main St, Corona, CA", phone: "951-555-9876", email: "store@gourmetgarden.com" },
    terms: "Paid",
    items: [
      { desc: "Organic Produce Bundle", qty: 1, rate: 45.00 },
      { desc: "Prime Grade Ribeye", qty: 2, rate: 32.50 },
      { desc: "Imported Olive Oil", qty: 1, rate: 18.99 }
    ],
    taxRate: 0.0875
  },
  "Transportation": {
    seller: { name: "Apex Auto Service & Fuel", addr: "888 Turbo Way, Long Beach, CA", phone: "562-555-0199", email: "service@apexauto.com" },
    terms: "Net 15",
    items: [
      { desc: "91 Octane Fuel", qty: 14.2, rate: 5.85 },
      { desc: "Synthetic Oil Change Service", qty: 1, rate: 85.00 },
      { desc: "Shop Supplies & Disposal", qty: 1, rate: 12.50 }
    ],
    taxRate: 0.095
  },
  "Utilities": {
    seller: { name: "City Water & Power", addr: "1 Utilities Plaza, Corona, CA", phone: "951-555-4000", email: "support@cwp-corona.gov" },
    terms: "Net 30",
    items: [{ desc: "Water Usage (Tier 1)", qty: 450, rate: 0.25 }, { desc: "Electric Service - Residential", qty: 1, rate: 88.40 }]
  },
  "Subscriptions": {
    seller: { name: "StreamLine SaaS Corp", addr: "500 Silicon Way, San Jose, CA", phone: "408-555-0111", email: "billing@streamline.io" },
    terms: "Subscription Auto-Renew",
    items: [{ desc: "Annual Developer Pro License", qty: 1, rate: 599.00 }],
    discount: 50.00
  },
  "Personal expenses": {
    seller: { name: "Iron Temple Fitness", addr: "202 Muscle Rd, Norco, CA", phone: "951-555-7722", email: "members@irontemple.com" },
    terms: "Due on Receipt",
    items: [{ desc: "Personal Training Session (1hr)", qty: 3, rate: 75.00 }]
  },
  "Savings and investments": {
    seller: { name: "Vanguard Direct", addr: "100 Vanguard Blvd, Malvern, PA", phone: "800-555-1234", email: "investor@vanguard.com" },
    terms: "N/A",
    items: [{ desc: "VTSAX Share Purchase", qty: 10.45, rate: 112.40 }]
  },
  "Debt or student loan payments": {
    seller: { name: "First National Student Loans", addr: "PO Box 9922, Denver, CO", phone: "888-555-0011", email: "payments@fnsl.com" },
    terms: "Net 10",
    items: [{ desc: "Direct Subsidized Loan Payment", qty: 1, rate: 420.00 }]
  },
  "Health care": {
    seller: { name: "Bright Smile Dental", addr: "45 Medical Cir, Riverside, CA", phone: "951-555-3322", email: "frontdesk@brightsmile.com" },
    terms: "Net 30",
    items: [{ desc: "Routine Prophylaxis (Cleaning)", qty: 1, rate: 125.00 }, { desc: "Bite-Wing X-Rays", qty: 1, rate: 45.00 }]
  },
  "Miscellaneous expenses": {
    seller: { name: "Amazon Business", addr: "410 Terry Ave N, Seattle, WA", phone: "206-555-0100", email: "business@amazon.com" },
    terms: "Paid via Credit Card",
    items: [{ desc: "Standing Desk Converter", qty: 1, rate: 149.99 }, { desc: "Mechanical Keyboard", qty: 1, rate: 89.00 }],
    shipping: 12.99
  }
};

// --- THE TEMPLATE ENGINE ---
function generateHTML(category, data, index) {
  const invNum = `INV-${category.substring(0,3).toUpperCase()}-${1000 + index}`;
  const subtotal = data.items.reduce((sum, item) => sum + (item.qty * item.rate), 0);
  const tax = subtotal * (data.taxRate || 0);
  const total = subtotal + tax + (data.shipping || 0) - (data.discount || 0);

  return `
    <div class="max-w-4xl mx-auto p-12 bg-white text-slate-800 shadow-lg border border-slate-100 font-sans">
      <div class="flex justify-between items-start mb-12">
        <div>
          <h1 class="text-4xl font-black text-blue-600 tracking-tighter uppercase mb-2 italic">Invoice</h1>
          <p class="text-sm font-mono text-slate-400"># ${invNum}</p>
        </div>
        <div class="text-right">
          <h2 class="font-bold text-lg">${data.seller.name}</h2>
          <p class="text-xs text-slate-500">${data.seller.addr}</p>
          <p class="text-xs text-slate-500">${data.seller.phone} | ${data.seller.email}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-12 mb-12 border-y border-slate-100 py-8">
        <div>
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Bill To</p>
          <p class="font-bold text-slate-900 text-lg">Joel Muniz</p>
          <p class="text-sm text-slate-500">Corona, California 92882</p>
        </div>
        <div class="grid grid-cols-2 gap-4 text-right">
          <div>
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date Issued</p>
            <p class="text-sm font-semibold">March 25, 2026</p>
          </div>
          <div>
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Due Date</p>
            <p class="text-sm font-semibold text-blue-600">${data.terms}</p>
          </div>
        </div>
      </div>

      <table class="w-full mb-12">
        <thead>
          <tr class="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 text-left">
            <th class="pb-4">Description</th>
            <th class="pb-4 text-center">Qty</th>
            <th class="pb-4 text-right">Rate</th>
            <th class="pb-4 text-right">Amount</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          ${data.items.map(item => `
            <tr>
              <td class="py-4 text-sm font-medium">${item.desc}</td>
              <td class="py-4 text-sm text-center">${item.qty}</td>
              <td class="py-4 text-sm text-right">$${item.rate.toFixed(2)}</td>
              <td class="py-4 text-sm text-right font-bold">$${(item.qty * item.rate).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="flex justify-end">
        <div class="w-64 space-y-3">
          <div class="flex justify-between text-sm"><span class="text-slate-500">Subtotal:</span><span class="font-semibold">$${subtotal.toFixed(2)}</span></div>
          ${tax > 0 ? `<div class="flex justify-between text-sm"><span class="text-slate-500">Tax (${(data.taxRate*100).toFixed(1)}%):</span><span class="font-semibold">$${tax.toFixed(2)}</span></div>` : ''}
          ${data.shipping ? `<div class="flex justify-between text-sm"><span class="text-slate-500">Shipping:</span><span class="font-semibold">$${data.shipping.toFixed(2)}</span></div>` : ''}
          ${data.discount ? `<div class="flex justify-between text-sm text-red-600 font-medium"><span>Discount:</span><span>-$${data.discount.toFixed(2)}</span></div>` : ''}
          <div class="flex justify-between text-lg font-black border-t border-slate-200 pt-3">
            <span>Total Due:</span>
            <span class="text-blue-600">$${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div class="mt-16 pt-8 border-t border-slate-100 italic text-[10px] text-slate-400">
        <p>Payment Methods: ACH Routing: 021000021 | Account: ****9928. Thank you for your business!</p>
      </div>
    </div>
  `;
}

// --- RUNNER ---
async function runBatch() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1200 });

  console.log("🚀 Generating 30 Realistic Invoices...");

  for (const [category, data] of Object.entries(invoiceData)) {
    for (let i = 1; i <= 3; i++) {
      const fileName = `${category.replace(/\s+/g, '_')}_${i}`;
      await page.setContent(`
        <script src="https://cdn.tailwindcss.com"></script>
        <div class="bg-slate-200 p-20 min-h-screen">
          ${generateHTML(category, data, i)}
        </div>
      `);
      await page.waitForNetworkIdle();
      await page.screenshot({ path: `./public/${fileName}.png`, fullPage: false });
      console.log(`✔ Generated: ${fileName}.png`);
    }
  }

  await browser.close();
  console.log("✨ Done!");
}
runBatch();