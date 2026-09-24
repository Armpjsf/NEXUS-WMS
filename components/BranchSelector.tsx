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
    
    // Default Fallback: URT to match TMS Surat Thani
    const defaultBranch = { id: 'URT', name: 'สาขาสุราษฎร์ธานี (URT)', color: 'teal', spreadsheetId: '' };

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
    const allowedBranches = session?.user?.allowedBranches || ['*']; // Default * if not loaded yet
    
    const visibleBranches = branches.filter(b => {
        if (allowedBranches.includes('*')) return true;
        return allowedBranches.includes(b.id);
    });

    const currentBranchId = searchParams.get('branchId') || 'URT';
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

    if (loading) return <div className="w-full h-11 rounded-lg bg-[#1b2027] border border-[#30353d] animate-pulse" />;

    return (
        <div className="relative z-50">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2.5 bg-[#090f15] border border-[#30353d] rounded-lg hover:border-[#facc15]/60 transition-all shadow-sm group"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-[#252a32] border border-[#30353d] flex items-center justify-center text-[#facc15] shrink-0">
                        <Store className="w-4 h-4" />
                    </div>
                    <div className="text-left min-w-0 flex-1">
                        <p className="text-[9px] uppercase font-mono text-[#d1c6ab] tracking-wider leading-none mb-1 truncate">
                            ศูนย์กระจายสินค้า / สาขา
                        </p>
                        <p className="text-xs font-bold text-[#dee2ec] line-clamp-1 tracking-tight">
                            {currentBranch.name}
                        </p>
                    </div>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-[#d1c6ab] shrink-0 transition-transform", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute top-full left-0 right-0 mt-1.5 bg-[#171c23] rounded-lg shadow-2xl border border-[#30353d] overflow-hidden z-50 max-h-60 overflow-y-auto font-mono text-xs"
                        >
                            {visibleBranches.map((branch) => (
                                <button
                                    key={branch.id}
                                    onClick={() => handleSelect(branch.id)}
                                    className="w-full flex items-center justify-between p-2.5 hover:bg-[#252a32] transition-colors text-left border-b border-[#30353d]/30"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={cn(
                                            "w-2 h-2 rounded-full",
                                            currentBranchId === branch.id ? "bg-[#facc15]" : "bg-[#4cd7f6]"
                                        )} />
                                        <span className={cn(
                                            "font-semibold transition-colors",
                                            currentBranchId === branch.id ? "text-[#facc15]" : "text-[#dee2ec]"
                                        )}>
                                            {branch.name}
                                        </span>
                                    </div>
                                    {currentBranchId === branch.id && (
                                        <Check className="w-3.5 h-3.5 text-[#facc15]" />
                                    )}
                                </button>
                            ))}
                            
                            {/* Quick Link to Manage */}
                            <button
                                onClick={() => {
                                    router.push('/admin/branches');
                                    setIsOpen(false);
                                }}
                                className="w-full p-2 text-[11px] font-bold text-[#facc15] bg-[#252a32] hover:bg-[#30353d] transition-colors text-center border-t border-[#30353d]"
                            >
                                + จัดการสาขา (Manage Branches)
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
