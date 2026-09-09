import { NextResponse } from "next/server";
import { getProducts, getTransactionsUncached, getCycleCountLogs, type Product } from "@/lib/data/wms";

export const dynamic = "force-dynamic";

interface DailyCountItem {
  product_name: string;
  location: string;
  zone: string;
  system_qty: number;
  unit: string;
  movement_type: "IN" | "OUT" | "BOTH";
  today_in: number;
  today_out: number;
  last_movement: string;
}

export async function GET() {
  try {
    // 1. Get Today's Date in Thailand Time (UTC+7)
    // We need to match the date format stored in Sheets (usually YYYY-MM-DD or DD/MM/YYYY)
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);

    console.log(`[Daily Count] Fetching movements for: ${todayStr}`);

    // 2. Fetch Data in Parallel
    const [products, inbound, outbound, logs] = await Promise.all([
      getProducts(),
      getTransactionsUncached("IN"),
      getTransactionsUncached("OUT"),
      getCycleCountLogs()
    ]);

    // 3. Filter Transactions for TODAY
    const moveMap = new Map<
      string,
      { in: number; out: number; lastTime: string }
    >();

    const processTx = (txs: any[], type: "IN" | "OUT") => {
      txs.forEach((tx) => {
        // tx.date might be YYYY-MM-DD
        if (tx.date === todayStr && tx.product) {
          const existing = moveMap.get(tx.product) || {
            in: 0,
            out: 0,
            lastTime: tx.date,
          };
          if (type === "IN") existing.in += tx.qty || 0;
          else existing.out += tx.qty || 0;

          moveMap.set(tx.product, existing);
        }
      });
    };

    processTx(inbound, "IN");
    processTx(outbound, "OUT");

    console.log(`[Daily Count] Found ${moveMap.size} active products today.`);

    // 4. Build Result List
    const results: DailyCountItem[] = [];

    moveMap.forEach((mov, productName) => {
      // Find product details
      const product = products.find((p) => p.name === productName);

      const location = product?.location || "-";
      const zone = location.split("-")[0] || "Unknown";

      let mType: "IN" | "OUT" | "BOTH" = "BOTH";
      if (mov.in > 0 && mov.out === 0) mType = "IN";
      else if (mov.out > 0 && mov.in === 0) mType = "OUT";

      results.push({
        product_name: productName,
        location: location,
        zone: zone,
        system_qty: product?.stock || 0,
        unit: product?.unit || "pcs",
        movement_type: mType,
        today_in: mov.in,
        today_out: mov.out,
        last_movement: mov.lastTime,
      });
    });
    
    // 5. Filter out items alreay counted TODAY
    const countedToday = new Set<string>();
    logs.forEach(log => {
         // Log date might be YYYY-MM-DD or DD/MM/YYYY. 
         // Assuming getCycleCountLogs returns raw strings, lets check match.
         // If stored as YYYY-MM-DD, direct match.
         if (log.count_date === todayStr) {
             countedToday.add(log.product_name);
         }
         // Handle potential Thai format if needed (though we standardized on YYYY-MM-DD in write)
    });

    const finalResults = results.filter(r => !countedToday.has(r.product_name));

    // 6. Sort by Zone -> Location
    finalResults.sort((a, b) => {
      if (a.zone !== b.zone) return a.zone.localeCompare(b.zone);
      return a.location.localeCompare(b.location);
    });

    return NextResponse.json(finalResults);
  } catch (error) {
    console.error("Error fetching daily count items:", error);
    return NextResponse.json(
      { error: "Failed to fetch items" },
      { status: 500 }
    );
  }
}

// Vercel: allow up to 60s (Hobby max) — this route does Sheets-heavy work.
export const maxDuration = 60;
