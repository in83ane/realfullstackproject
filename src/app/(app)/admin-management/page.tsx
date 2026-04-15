"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    Users, ArrowLeft, Plus, Trash2, Shield, Mail, Lock, Loader2, X, Crown
} from "lucide-react";
import Link from "next/link";

interface AdminUser {
    id: string;
    email: string;
    role: string;
    created_at: string;
}

export default function AdminManagementPage() {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);

    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [error, setError] = useState<string | null>(null);

    // Check if current user is owner
    useEffect(() => {
        async function checkOwner() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("role")
                    .eq("id", user.id)
                    .single();

                // Owner emails ได้ role 'owner' เสมอ
                const OWNER_EMAILS = ['realrockza@gmail.com'];
                const isOwner = user.email ? OWNER_EMAILS.includes(user.email) : false;
                const role = isOwner ? 'owner' : (profile?.role || 'user');
                setUserRole(role);

                // Redirect non-owners
                if (role !== 'owner') {
                    router.push('/home');
                    return;
                }
            }
            await fetchAdmins();
            setLoading(false);
        }
        checkOwner();
    }, [supabase, router]);

    const fetchAdmins = async () => {
        const { data, error } = await supabase
            .from("profiles")
            .select("id, email, role, created_at")
            .in("role", ["admin", "owner"])
            .order("created_at", { ascending: false });

        if (!error && data) {
            setAdmins(data as AdminUser[]);
        }
    };

    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            // Call API to create admin user
            const res = await fetch("/admin-management/api", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                }),
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || "Failed to create admin");
            }

            // Success
            setFormData({ email: "", password: "" });
            setShowAddForm(false);
            await fetchAdmins();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveAdmin = async (adminId: string, adminEmail: string) => {
        if (!confirm(`Are you sure you want to remove admin privileges from ${adminEmail}?`)) {
            return;
        }

        const res = await fetch("/admin-management/api", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: adminId }),
        });

        const result = await res.json();

        if (!res.ok) {
            alert(result.error || "Failed to remove admin");
        } else {
            await fetchAdmins();
        }
    };

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-slate-300" size={40} />
            </div>
        );
    }

    // Only owner can access this page
    if (userRole !== 'owner') {
        return null; // Will redirect
    }

    return (
        <main className="max-w-5xl mx-auto p-4 md:p-8 min-h-screen bg-slate-50/30">
            {/* Header */}
            <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 md:p-3 bg-slate-900 rounded-xl md:rounded-2xl text-white shadow-xl">
                        <Shield size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">
                            จัดการแอดมิน
                        </h1>
                        <p className="text-slate-400 font-bold text-xs md:text-sm">
                            เพิ่มหรือลบสิทธิ์แอดมิน
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="bg-slate-900 text-white px-4 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-lg hover:bg-slate-800 transition-all text-sm"
                    >
                        <Plus size={16} /> เพิ่มแอดมิน
                    </button>
                    <Link
                        href="/home"
                        className="text-slate-400 hover:text-slate-900 font-bold text-sm flex items-center gap-1.5 ml-2 px-2 transition-colors"
                    >
                        <ArrowLeft size={16} /> กลับ
                    </Link>
                </div>
            </header>

            {/* Admin List */}
            <section className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border-4 border-white shadow-xl overflow-hidden">
                <div className="p-4 md:p-6 border-b border-slate-50 bg-slate-50/30">
                    <h3 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                        <Users size={18} className="text-slate-400" />
                        รายชื่อแอดมิน ({admins.length})
                    </h3>
                </div>

                <div className="divide-y divide-slate-100">
                    {admins.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <p className="text-sm font-bold">ไม่มีแอดมินในระบบ</p>
                        </div>
                    ) : (
                        admins.map((admin) => (
                            <div
                                key={admin.id}
                                className="p-4 md:p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                            >
                                <div className="flex items-center gap-3 md:gap-4">
                                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center ${admin.role === 'owner' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {admin.role === 'owner' ? <Crown size={20} /> : <Shield size={20} />}
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-900 text-sm md:text-base">
                                            {admin.email}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${admin.role === 'owner' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {admin.role === 'owner' ? 'Owner' : 'Admin'}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                {new Date(admin.created_at).toLocaleDateString('th-TH')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {admin.role !== 'owner' && (
                                    <button
                                        onClick={() => handleRemoveAdmin(admin.id, admin.email)}
                                        className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl transition-all"
                                        title="ลบสิทธิ์แอดมิน"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* Add Admin Modal */}
            {showAddForm && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowAddForm(false)}
                    />
                    <div className="relative w-full md:max-w-md bg-white rounded-t-[2rem] md:rounded-[2rem] border-4 border-white shadow-2xl p-6 md:p-8">
                        <div className="flex justify-center mb-1 md:hidden">
                            <div className="w-10 h-1 bg-slate-200 rounded-full" />
                        </div>

                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-600 rounded-xl text-white">
                                    <Plus size={17} />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-slate-900">เพิ่มแอดมินใหม่</h2>
                                    <p className="text-xs font-bold text-slate-400">สร้างบัญชีแอดมิน</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAddForm(false)}
                                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddAdmin} className="space-y-4">
                            <div className="space-y-3">
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                    <input
                                        type="email"
                                        placeholder="Email"
                                        required
                                        className="w-full pl-11 p-3.5 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-xl font-bold outline-none text-sm"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                    <input
                                        type="password"
                                        placeholder="Password (6+ characters)"
                                        required
                                        minLength={6}
                                        className="w-full pl-11 p-3.5 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-xl font-bold outline-none text-sm"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    />
                                </div>
                            </div>

                            {error && (
                                <p className="text-xs font-bold text-rose-500 bg-rose-50 border-2 border-rose-100 px-4 py-3 rounded-xl">
                                    {error}
                                </p>
                            )}

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="flex-1 py-3.5 bg-slate-100 text-slate-500 rounded-xl font-black hover:bg-slate-200 transition-all text-sm"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-3.5 bg-slate-900 text-white rounded-xl font-black hover:bg-slate-800 disabled:opacity-50 transition-all text-sm flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <Loader2 className="animate-spin" size={15} />
                                    ) : (
                                        <Plus size={15} />
                                    )}
                                    เพิ่มแอดมิน
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}
