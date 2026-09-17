
export interface SlottingInsight {
    productId: string;
    sku: string;
    productName: string;
    currentLocation: string;
    recommendedBin: string;
    stock: number;
    velocityScore: number; // Total Outbound Qty
    pickCount: number; // Number of distinct pick times
    class: 'A' | 'B' | 'C' | 'D'; // A=Top20%, B=Next30%, C=Bottom50%, D=Deadstock
    idealZone: string;
    action: 'MOVE_FORWARD' | 'MOVE_BACK' | 'KEEP';
    reason: string;
    estimatedDistanceSavedMeters: number;
}

export interface SlottingSummary {
    totalAnalyzed: number;
    suboptimalCount: number;
    classDistribution: {
        A: number;
        B: number;
        C: number;
        D: number;
    };
    estimatedWeeklyDistanceSavedKm: number;
    recommendations: SlottingInsight[];
    all: SlottingInsight[];
}

export function performABCAnalysis(products: any[], transactions: any[]): SlottingSummary {
    // 1. Calculate Velocity (Total Outbound Qty) and Pick Count per Product
    const velocityMap = new Map<string, number>();
    const pickCountMap = new Map<string, number>();
    
    transactions.forEach(t => {
        if (t.type === 'OUT' || t.transaction_type === 'OUT') {
            const pid = t.product_id || t.productId;
            const sku = t.sku;
            const key = sku || pid || t.product || t.product_name; 
            
            if (key) {
                const qty = Number(t.qty || t.quantity || 0);
                velocityMap.set(key, (velocityMap.get(key) || 0) + qty);
                pickCountMap.set(key, (pickCountMap.get(key) || 0) + 1);
            }
        }
    });

    // 2. Rank Products by velocity
    const rankedProducts = products.map(p => {
        const skuKey = p.sku || p.id || p.name;
        const nameKey = p.name;
        const velocity = velocityMap.get(skuKey) || velocityMap.get(nameKey) || 0;
        const picks = pickCountMap.get(skuKey) || pickCountMap.get(nameKey) || 0;
        return { ...p, velocity, picks };
    }).sort((a, b) => b.velocity - a.velocity);

    const totalItems = rankedProducts.length;
    const insights: SlottingInsight[] = [];
    let totalDistanceSavedMeters = 0;

    // Available front bins to suggest for Class A
    const goldenZoneBins = ['A-01-01', 'A-01-02', 'A-02-01', 'A-02-02', 'A-03-01'];
    // Available back bins to suggest for Class C/D
    const backZoneBins = ['C-01-01', 'C-01-02', 'C-02-01', 'C-02-02', 'D-01-01'];

    let goldenBinIdx = 0;
    let backBinIdx = 0;

    rankedProducts.forEach((p, index) => {
        let assignedClass: 'A' | 'B' | 'C' | 'D' = 'C';
        
        if (p.velocity === 0) {
            assignedClass = 'D';
        } else {
            const percentile = totalItems > 0 ? (index / totalItems) * 100 : 100;
            if (percentile <= 20) assignedClass = 'A';
            else if (percentile <= 50) assignedClass = 'B';
            else assignedClass = 'C';
        }

        const currentLoc = p.location || 'Unassigned';
        let action: 'MOVE_FORWARD' | 'MOVE_BACK' | 'KEEP' = 'KEEP';
        let idealZone = 'Any Zone';
        let recommendedBin = currentLoc;
        let reason = 'ตำแหน่งจัดวางเหมาะสมกับความถี่การเบิกจ่ายแล้ว';
        let estimatedDistanceSaved = 0;

        // Zone detection (A, B, C, D)
        const currentZoneMatch = currentLoc.match(/^([A-Z])/i); 
        const currentZone = currentZoneMatch ? currentZoneMatch[1].toUpperCase() : null;

        if (assignedClass === 'A') {
            idealZone = 'Golden Zone (หน้าคลัง / แร็ค A)';
            if (!currentZone || currentZone > 'A') {
                action = 'MOVE_FORWARD';
                recommendedBin = goldenZoneBins[goldenBinIdx % goldenZoneBins.length];
                goldenBinIdx++;
                // Approx 50 meters round-trip saved per pick when moved from Zone C/B to Zone A
                const picks = Math.max(1, p.picks || 1);
                estimatedDistanceSaved = picks * 45; // 45 meters per pick
                totalDistanceSavedMeters += estimatedDistanceSaved;
                reason = `สินค้าขายดีติดอันดับ Top 20% (Class A) ปัจจุบันอยู่ ${currentLoc} แนะนำย้ายมา Golden Zone เพื่อลดระยะเดินหยิบ`;
            }
        } else if (assignedClass === 'C' || assignedClass === 'D') {
            idealZone = 'Deep Storage (แร็คชั้นใน / แร็ค C)';
            if (currentZone && currentZone < 'C') {
                action = 'MOVE_BACK';
                recommendedBin = backZoneBins[backBinIdx % backZoneBins.length];
                backBinIdx++;
                reason = `สินค้าเคลื่อนไหวน้อยหรือ Deadstock (Class ${assignedClass}) กำลังกินพื้นที่ชั้นวางทองคำแถวหน้า (${currentLoc}) แนะนำย้ายไปเก็บโซนด้านหลังเพื่อเปิดทางให้ของขายดี`;
            }
        } else {
            idealZone = 'Mid Zone (แร็คแถวกลาง / แร็ค B)';
        }

        insights.push({
            productId: p.id || p.sku || `prod-${index}`,
            sku: p.sku || p.id || p.name,
            productName: p.name,
            currentLocation: currentLoc,
            recommendedBin,
            stock: Number(p.stock || 0),
            velocityScore: p.velocity,
            pickCount: p.picks,
            class: assignedClass,
            idealZone,
            action,
            reason,
            estimatedDistanceSavedMeters: estimatedDistanceSaved
        });
    });

    const recommendations = insights.filter(i => i.action !== 'KEEP');
    // Calculate weekly distance saved in Kilometers (assumes monthly velocity divided by 4)
    const estimatedWeeklyDistanceSavedKm = Number(((totalDistanceSavedMeters * 1.5) / 1000).toFixed(1));

    return {
        totalAnalyzed: products.length,
        suboptimalCount: recommendations.length,
        classDistribution: {
            A: insights.filter(i => i.class === 'A').length,
            B: insights.filter(i => i.class === 'B').length,
            C: insights.filter(i => i.class === 'C').length,
            D: insights.filter(i => i.class === 'D').length,
        },
        estimatedWeeklyDistanceSavedKm: Math.max(0.5, estimatedWeeklyDistanceSavedKm),
        recommendations,
        all: insights
    };
}

