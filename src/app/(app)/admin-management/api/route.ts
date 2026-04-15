import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Owner emails - ได้ role owner เสมอ
const OWNER_EMAILS = ['realrockza@gmail.com'];

// Helper function to check if user is owner
function isOwnerEmail(email: string | undefined): boolean {
    return email ? OWNER_EMAILS.includes(email) : false;
}

// POST - Create new admin user
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();

        // Check if current user is owner
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .single();

        if (profile?.role !== 'owner' && !isOwnerEmail(currentUser.email)) {
            return NextResponse.json({ error: "Only owner can add admins" }, { status: 403 });
        }

        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: "Email and password required" }, { status: 400 });
        }

        // Create user using admin API (requires service role key)
        // For now, we'll use signUp which creates a user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${req.nextUrl.origin}/auth/callback`,
            },
        });

        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 400 });
        }

        if (authData.user) {
            // Update profile to admin role
            const { error: profileError } = await supabase
                .from("profiles")
                .update({ role: 'admin', email })
                .eq("id", authData.user.id);

            if (profileError) {
                return NextResponse.json({ error: profileError.message }, { status: 500 });
            }

            return NextResponse.json({ user: authData.user });
        }

        return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    } catch (error) {
        console.error("Error creating admin:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// PATCH - Update user to admin
export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createClient();

        // Check if current user is owner
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .single();

        if (profile?.role !== 'owner' && !isOwnerEmail(currentUser.email)) {
            return NextResponse.json({ error: "Only owner can manage admins" }, { status: 403 });
        }

        const { userId, newPassword } = await req.json();

        if (newPassword) {
            // Reset password
            const { error } = await supabase.auth.admin.updateUserById(userId, {
                password: newPassword,
            });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    } catch (error) {
        console.error("Error updating user:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// DELETE - Remove admin privileges (set back to user)
export async function DELETE(req: NextRequest) {
    try {
        const supabase = await createClient();

        // Check if current user is owner
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .single();

        if (profile?.role !== 'owner' && !isOwnerEmail(currentUser.email)) {
            return NextResponse.json({ error: "Only owner can remove admins" }, { status: 403 });
        }

        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: "User ID required" }, { status: 400 });
        }

        // Update profile role to 'user'
        const { error: profileError } = await supabase
            .from("profiles")
            .update({ role: 'user' })
            .eq("id", userId);

        if (profileError) {
            return NextResponse.json({ error: profileError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error removing admin:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
