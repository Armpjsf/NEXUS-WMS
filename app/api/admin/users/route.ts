import { NextResponse } from 'next/server';
import { getUsers, addUser, updateUser, deleteUser } from '@/lib/users';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAction } from "@/lib/auditTrail";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const users = await getUsers();
    // If empty (first run), return default admin for checking
    if (users.length === 0) {
        return NextResponse.json([{ id: 'admin', username: 'admin', role: 'Admin', status: 'Active', lastLogin: '-' }]);
    }
    return NextResponse.json(users);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const adminUser = session?.user as any;
        const currentUser = adminUser?.username || 'Unknown Admin';
        const currentUserId = adminUser?.id || 'admin';

        const body = await req.json();
        
        if (body.action === 'add') {
            const result = await addUser(body.data);
            if (result && typeof result === 'object' && 'error' in result) {
                return NextResponse.json({ error: (result as any).error }, { status: 403 });
            }

            await logAction({
                 userId: currentUserId,
                 userName: currentUser,
                 action: 'CREATE',
                 module: 'users',
                 description: `Created user: ${body.data.username} (${body.data.role})`,
                 newValues: { username: body.data.username, role: body.data.role, branches: body.data.allowedBranches }
            });

            return NextResponse.json({ success: true });
        } else if (body.action === 'update') {
            await updateUser(body.id, body.data);
            
            await logAction({
                 userId: currentUserId,
                 userName: currentUser,
                 action: 'UPDATE',
                 module: 'users',
                 description: `Updated user: ${body.data.username || body.id}`,
                 newValues: body.data
            });

            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const adminUser = session?.user as any;
        const currentUser = adminUser?.username || 'Unknown Admin';
        const currentUserId = adminUser?.id || 'admin';

        const { id } = await req.json();
        if (!id) return NextResponse.json({ error: 'Missing user id' }, { status: 400 });

        const ok = await deleteUser(id);
        if (!ok) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        await logAction({
            userId: currentUserId,
            userName: currentUser,
            action: 'DELETE',
            module: 'users',
            description: `Deleted user: ${id}`,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
