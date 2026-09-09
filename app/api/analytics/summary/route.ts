import { NextResponse } from 'next/server';
import { getTransactions } from '@/lib/data/wms';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const granularity = searchParams.get('granularity') || 'month';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const inboundAll = await getTransactions('IN');
    const outboundAll = await getTransactions('OUT');

    const filterByDate = (t: any) => {
        if (!t.date) return false;
        const d = new Date(t.date);
        if (startDate && d < new Date(startDate)) return false;
        if (endDate && d > new Date(endDate + 'T23:59:59')) return false; // End of day
        return true;
    };

    const inbound = inboundAll.filter(filterByDate);
    const outbound = outboundAll.filter(filterByDate);

    // Helper to group data
    const groupData = (data: any[], keyFn: (d: Date) => string) => {
        const map = new Map<string, number>();
        data.forEach(t => {
            if (!t.date) return;
            const d = new Date(t.date);
            if (isNaN(d.getTime())) return;
            
            const key = keyFn(d);
            map.set(key, (map.get(key) || 0) + t.qty);
        });
        return map;
    };

    // 1. Comparison Series (In vs Out)
    let keyFn;
    if (granularity === 'day') {
        keyFn = (d: Date) => d.toISOString().split('T')[0]; // YYYY-MM-DD
    } else {
        keyFn = (d: Date) => d.toISOString().substring(0, 7); // YYYY-MM
    }

    const inMap = groupData(inbound, keyFn);
    const outMap = groupData(outbound, keyFn);

    // Merge keys
    const allKeys = Array.from(new Set([...inMap.keys(), ...outMap.keys()])).sort();
    
    const chartData = allKeys.map(key => ({
        name: key,
        in: inMap.get(key) || 0,
        out: outMap.get(key) || 0
    }));

    // 2. Weekday Analysis (Legacy Feature parity)
    // Only for outbound usually, but let's do both
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayMap = new Map<number, number>(); // 0-6
    
    outbound.forEach(t => {
        if (!t.date) return;
        const d = new Date(t.date);
        if (isNaN(d.getTime())) return;
        
        const day = d.getDay();
        weekdayMap.set(day, (weekdayMap.get(day) || 0) + t.qty);
    });

    const weekdayAnalysis = weekdays.map((day, idx) => ({
        day,
        qty: weekdayMap.get(idx) || 0
    }));

    // 3. Recent Transactions (Detailed Table)
    const recentTransactions = [
        ...inbound.map(t => ({ ...t, type: 'IN' })),
        ...outbound.map(t => ({ ...t, type: 'OUT' }))
    ]
    .filter(t => t.date && !isNaN(new Date(t.date).getTime()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 100);

    return NextResponse.json({
        chartData,
        weekdayAnalysis,
        recentTransactions
    });

  } catch (error: any) {
    console.error("Summary API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
