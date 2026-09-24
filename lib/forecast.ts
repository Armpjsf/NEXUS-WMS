export type TrendResult = {
    slope: number;       // Growth or shrink rate per unit
    intercept: number;   // Base value
    rSquared: number;    // Confidence (0-1)
    prediction: number;  // Next value prediction
    trend: 'UP' | 'DOWN' | 'STABLE';
    growthRate: number; // Percent growth
};

/**
 * Calculates Simple Linear Regression (Least Squares)
 * @param data Array of numbers (chronological order)
 * @returns TrendResult
 */
export function calculateTrend(data: number[]): TrendResult {
    const n = data.length;
    if (n < 2) {
        return { slope: 0, intercept: 0, rSquared: 0, prediction: data[0] || 0, trend: 'STABLE', growthRate: 0 };
    }

    const x = Array.from({ length: n }, (_, i) => i); // [0, 1, 2, ... n-1]
    const y = data;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
    const sumXX = x.reduce((a, b) => a + b * b, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-Squared
    const yMean = sumY / n;
    const ssRes = y.reduce((a, b, i) => {
        const pred = slope * i + intercept;
        return a + Math.pow(b - pred, 2);
    }, 0);
    const ssTot = y.reduce((a, b) => a + Math.pow(b - yMean, 2), 0);
    const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

    const nextX = n; // Predict next period
    const prediction = Math.max(0, slope * nextX + intercept);

    let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
    if (slope > 0.1) trend = 'UP';
    if (slope < -0.1) trend = 'DOWN';

    // Growth Rate (Slope vs Average)
    const growthRate = yMean === 0 ? 0 : (slope / yMean) * 100;

    return {
        slope,
        intercept,
        rSquared,
        prediction,
        trend,
        growthRate
    };
}

/**
 * Calculates Safety Stock based on Standard Deviation
 * @param data Usage history
 * @param serviceLevelZStd Z-score (1.65 = 95%, 2.33 = 99%)
 * @param leadTime Days
 */
export function calculateSafetyStock(data: number[], leadTime: number = 7, serviceLevelZStd: number = 1.65): number {
    if (data.length < 2) return 0;

    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (data.length - 1);
    const stdDev = Math.sqrt(variance);

    // Standard Safety Stock Formula: Z * StdDev * Sqrt(LeadTime)
    // Note: Assuming daily std dev.
    return Math.ceil(serviceLevelZStd * stdDev * Math.sqrt(leadTime));
}

/**
 * Calculates average daily usage (Burn Rate) over a period.
 * @param dailyUsage Array of usage numbers (newest first or chronological? usually chronological for simple sum)
 * @returns Average items per day
 */
export function calculateBurnRate(dailyUsage: number[]): number {
    if (dailyUsage.length === 0) return 0;
    const total = dailyUsage.reduce((a, b) => a + b, 0);
    return total / dailyUsage.length;
}

/**
 * Predicts when stock will run out.
 * @param currentStock Current inventory level
 * @param burnRate Average daily consumption
 * @returns Object containing days left and estimated date
 */
export function predictStockout(currentStock: number, burnRate: number) {
    if (currentStock <= 0) return { daysLeft: 0, date: new Date().toISOString().split('T')[0], risk: 'CRITICAL' };
    if (burnRate <= 0) return { daysLeft: 999, date: null, risk: 'LOW' };

    const daysLeft = Math.floor(currentStock / burnRate);
    
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysLeft);

    let risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (daysLeft < 7) risk = 'CRITICAL';
    else if (daysLeft < 14) risk = 'HIGH';
    else if (daysLeft < 30) risk = 'MEDIUM';

    return {
        daysLeft,
        date: targetDate.toISOString().split('T')[0],
        risk
    };
}

/**
 * Generates a dataset for the Stock Depletion Chart.
 * `history` = real end-of-day stock (oldest first) from /api/stock/history.
 * Without it the chart shows only today + the projection — it no longer
 * invents past days from the burn rate.
 */
export function generateDepletionData(
    currentStock: number,
    burnRate: number,
    history: Array<{ date: string; stock: number }> = [],
) {
    const data: Array<{ date: string; stock: number; predicted: boolean }> = [];
    const today = new Date();

    // 1. Historical data (real ledger), or just today's point.
    if (history.length > 0) {
        for (const h of history) data.push({ date: h.date, stock: h.stock, predicted: false });
    } else {
        data.push({ date: today.toISOString().split('T')[0], stock: Math.round(currentStock), predicted: false });
    }

    // 2. Future Projection (Until 0)
    let futureStock = currentStock;
    let days = 0;
    while (futureStock > 0 && days < 30) { // Limit to 30 days projection to avoid infinite loops
        days++;
        futureStock -= burnRate;
        if (futureStock < 0) futureStock = 0;
        
        const d = new Date(today);
        d.setDate(today.getDate() + days);

        data.push({
            date: d.toISOString().split('T')[0],
            stock: Math.round(futureStock),
            predicted: true
        });
    }

    return data;
}
