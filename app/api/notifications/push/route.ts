import { NextResponse } from 'next/server';
import { messaging } from '@/lib/firebaseAdmin';
import { getDeviceTokens } from '@/lib/data/wms';

export async function POST(req: Request) {
    // Basic Security: Check for a secret key if needed, or open for now (Google Apps Script usage)
    try {
        const body = await req.json();
        const { title, body: msgBody, type, data } = body;

        if (!title || !msgBody) {
             return NextResponse.json({ error: "Title and body required" }, { status: 400 });
        }

        // Fetch tokens from Supabase
        const tokens = await getDeviceTokens();

        if (tokens.length === 0) {
            return NextResponse.json({ message: "No devices registered" });
        }

        if (messaging) {
            console.log(`[PushAPI] Sending '${title}' to ${tokens.length} devices...`);
            const response = await messaging.sendEachForMulticast({
                tokens: tokens,
                notification: {
                    title: title,
                    body: msgBody,
                },
                data: {
                    type: type || 'general',
                    ...data
                },
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        clickAction: 'FCM_PLUGIN_ACTIVITY'
                    }
                }
            });
            
            return NextResponse.json({ 
                success: true, 
                sent: response.successCount, 
                failed: response.failureCount 
            });
        } else {
             return NextResponse.json({ error: "Firebase not initialized" }, { status: 500 });
        }

    } catch (error: any) {
        console.error("[PushAPI] Error:", error);
         return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
