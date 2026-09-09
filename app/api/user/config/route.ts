
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserConfig, saveUserConfig } from "@/lib/data/wms";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
        return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    try {
        const config = await getUserConfig(session.user.email, key);
        return NextResponse.json({ value: config });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { key, value } = await request.json();

        if (!key || value === undefined) {
             return NextResponse.json({ error: "Key and Value are required" }, { status: 400 });
        }

        const success = await saveUserConfig(session.user.email, key, value);
        
        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
        }
    } catch (error) {
         return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
}
