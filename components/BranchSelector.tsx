'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Store, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// ... imports
import { getApiUrl } from '@/lib/config';

interface BranchConfig {
    id: string;
    name: string;
    spreadsheetId: string;
    color: string;
}

export default function BranchSelector() {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isOpen, setIsOpen] = useState(false);
    const [branches, setBranches] = useState<BranchConfig[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Default Fallback
    const defaultBranch = { id: 'hq', name: 'HQ (Default)', color: 'indigo', spreadsheetId: '' };

    useEffect(() => {
        // Skip fetch if not authenticated
        if (!session?.user) {
            setBranches([defaultBranch]);
            setLoading(false);
            return;
        }

        fetch(getApiUrl('/api/branches'))
            .then(res => {
                if (!res.ok) return [defaultBranch];
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setBranches(data);
                } else {
                    setBranches([defaultBranch]); 
                }
                setLoading(false);
            })
            .catch(() => {
                setBranches([defaultBranch]);
                setLoading(false);
            });
    }, [session]);

    // Filter Branches based on Permission
    const allowedBranches = (session?.user as any)?.allowedBranches || ['*']; // Default * if not loaded yet
    
    const visibleBranches = branches.filter(b => {
        if (allowedBranches.includes('*')) return true;
        return allowedBranches.includes(b.id);
    });

    const currentBranchId = searchParams.get('branchId') || 'hq';
    // Use visibleBranches to determine current branch display
    const currentBranch = visibleBranches.find(b => b.id === currentBranchId) || visibleBranches[0] || defaultBranch;

    // Auto-Redirect if on unauthorized branch
    useEffect(() => {
        if (!loading && visibleBranches.length > 0) {
            const isAllowed = visibleBranches.some(b => b.id === currentBranchId);
            // If current ID is not allowed (and not 'hq' fallback if hq is allowed? No, strict check)
            // Exception: If currentBranchId is 'hq' and user has access to it, it's fine.
            // If user DOES NOT have access to currentBranchId, switch to first allowed.
            
            if (!isAllowed) {
                 const firstAllowed = visibleBranches[0];
                 if (firstAllowed) {
                     const params = new URLSearchParams(searchParams.toString());
                     params.set('branchId', firstAllowed.id);
                     router.push(`?${params.toString()}`);
                 }
            }
        }
    }, [loading, visibleBranches, currentBranchId, router, searchParams]);

    const handleSelect = (branchId: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('branchId', branchId);
        router.push(`?${params.toString()}`);
        setIsOpen(false);
    };

    if (loading) return <div className="w-8 h-8 rounded-lg bg-slate-100 animate-pulse" />;

    return (
        <div className="relative z-50">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-all shadow-sm group"
            >
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg",
                        `bg-gradient-to-br from-${currentBranch.color}-500 to-${currentBranch.color}-700 shadow-${currentBranch.color}-200`
                    )}>
                        <Store className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                        <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest leading-none mb-1">Current Branch</p>
                        <p className="text-xs font-black text-slate-900 line-clamp-1 tracking-tight">{currentBranch.name}</p>
                    </div>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 max-h-60 overflow-y-auto"
                        >
                            {visibleBranches.map((branch) => (
                                <button
                                    key={branch.id}
                                    onClick={() => handleSelect(branch.id)}
                                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-3 h-3 rounded-full shadow-sm",
                                            `bg-gradient-to-br from-${branch.color}-500 to-${branch.color}-700`
                                        )} />
                                        <span className={cn(
                                            "text-sm font-black tracking-tight transition-colors",
                                            currentBranchId === branch.id ? "text-slate-900" : "text-slate-500"
                                        )}>
                                            {branch.name}
                                        </span>
                                    </div>
                                    {currentBranchId === branch.id && (
                                        <Check className="w-4 h-4 text-indigo-500" />
                                    )}
                                </button>
                            ))}
                            
                            {/* Quick Link to Manage */}
                            <button
                                onClick={() => {
                                    router.push('/admin/branches');
                                    setIsOpen(false);
                                }}
                                className="w-full p-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors text-center border-t border-indigo-100"
                            >
                                + Manage Branches
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
