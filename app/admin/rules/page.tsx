'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Plus, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface AutomationRule {
    id: string;
    name: string;
    triggerType: 'STOCK_LEVEL' | 'TRANSACTION' | 'SCHEDULE';
    condition: string;
    action: string;
    isActive: boolean;
    lastTriggered?: string;
}

export default function RulesPage() {
    const { t } = useLanguage();
    const [rules, setRules] = useState<AutomationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // New Rule Form State
    const [newName, setNewName] = useState("");
    const [triggerType, setTriggerType] = useState<'STOCK_LEVEL'>('STOCK_LEVEL');

    // Condition Builder State
    const [condField, setCondField] = useState("stock");
    const [condOp, setCondOp] = useState("<");
    const [condVal, setCondVal] = useState("10");

    // Action Builder State
    const [actionType, setActionType] = useState("LOG_ALERT");
    const [actionMsg, setActionMsg] = useState("Low Stock Alert!");

    useEffect(() => {
        fetchRules();
    }, []);

    const fetchRules = async () => {
        try {
            const res = await fetch('/api/admin/rules');
            const data = await res.json();
            if (Array.isArray(data)) {
                setRules(data);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load rules");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newName) return toast.error("Rule name is required");

        const newRule = {
            name: newName,
            triggerType,
            conditionRaw: { field: condField, operator: condOp, value: Number(condVal) },
            actionRaw: { type: actionType, payload: { message: actionMsg } },
            isActive: true
        };

        try {
            const res = await fetch('/api/admin/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRule)
            });

            if (res.ok) {
                toast.success("Rule Created!");
                setIsCreating(false);
                setNewName("");
                fetchRules();
            } else {
                toast.error("Failed to create rule");
            }
        } catch (e) {
            toast.error("Error creating rule");
        }
    };

    const toggleRule = async (rule: AutomationRule) => {
        const updated = { ...rule, isActive: !rule.isActive };
        setRules(rules.map(r => r.id === rule.id ? updated : r));

        try {
            const payload = {
                id: rule.id,
                name: rule.name,
                triggerType: rule.triggerType,
                conditionRaw: JSON.parse(rule.condition),
                actionRaw: JSON.parse(rule.action),
                isActive: !rule.isActive
            };

            await fetch('/api/admin/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            toast.success(updated.isActive ? "Rule Activated" : "Rule Deactivated");
        } catch (e) {
            toast.error("Failed to update status");
            fetchRules();
        }
    };

    return (
        <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-28 sm:px-6 lg:p-8 text-slate-900">
            <div className="mx-auto max-w-7xl space-y-6">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> {t('back_to_admin')}
            </Link>

            <header className="flex flex-col gap-4 pt-1 md:flex-row md:items-end md:justify-between">
                <div>
                     <div className="flex items-center gap-2 mb-1.5">
                       <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                         <Bot className="w-3 h-3 text-sky-600" />
                         Automation Control · Beta
                       </span>
                     </div>
                     <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                        {t('rules_title')}
                     </h1>
                     <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{t('rules_subtitle')}</p>
                </div>
                <button
                    onClick={() => setIsCreating(!isCreating)}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-full text-xs font-semibold transition-all shadow-sm w-fit"
                >
                    <Plus className="w-4 h-4" />
                    {t('new_rule')}
                </button>
            </header>

            {/* Create Rule Panel */}
            {isCreating && (
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="nx-glass-card p-6 md:p-8"
                >
                    <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Save className="w-5 h-5 text-emerald-600" />
                        {t('define_new_rule')}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left: Trigger */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Rule Name</label>
                                <input
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="e.g. Low Stock Alert for Electronics"
                                    className="w-full bg-white/90 border border-slate-200/80 rounded-xl px-4 py-2.5 font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                />
                            </div>

                            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">{t('if_condition')}</label>
                                <div className="flex gap-2">
                                    <select disabled className="bg-white border border-slate-200/80 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700">
                                        <option>When Stock Level</option>
                                    </select>
                                    <select
                                        value={condOp}
                                        onChange={e => setCondOp(e.target.value)}
                                        className="bg-white border border-slate-200/80 rounded-xl px-3 py-2 text-sm font-bold text-sky-700 text-center w-20 outline-none"
                                    >
                                        <option value="<">&lt;</option>
                                        <option value=">">&gt;</option>
                                        <option value="==">=</option>
                                    </select>
                                    <input
                                        type="number"
                                        value={condVal}
                                        onChange={e => setCondVal(e.target.value)}
                                        className="bg-white border border-slate-200/80 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 w-24 tabular-nums outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right: Action */}
                        <div className="space-y-4">
                            <div className="p-4 bg-sky-500/8 rounded-2xl border border-sky-500/20 h-full">
                                <label className="block text-[11px] font-bold text-sky-700 uppercase tracking-wider mb-3">{t('then_action')}</label>
                                <div className="space-y-3">
                                    <select
                                        value={actionType}
                                        onChange={e => setActionType(e.target.value)}
                                        className="w-full bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 outline-none"
                                    >
                                        <option value="LOG_ALERT">Show Dashboard Alert 🚨</option>
                                        <option value="LINE_NOTIFY" disabled>Send LINE Notify (Coming Soon)</option>
                                        <option value="EMAIL" disabled>Send Email (Coming Soon)</option>
                                    </select>

                                    <input
                                        value={actionMsg}
                                        onChange={e => setActionMsg(e.target.value)}
                                        placeholder="Alert Message..."
                                        className="w-full bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-200/70 flex justify-end gap-3">
                        <button
                            onClick={() => setIsCreating(false)}
                            className="px-5 py-2 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreate}
                            className="px-6 py-2 rounded-full text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all"
                        >
                            Create Rule
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Rules List */}
            {loading ? (
                <div className="text-center py-12 text-slate-500 text-sm">Loading rules...</div>
            ) : rules.length === 0 ? (
                <div className="nx-glass-card text-center py-16">
                    <Bot className="w-14 h-14 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-slate-900">{t('no_history')}</h3>
                    <p className="text-slate-600 text-sm mt-1">{t('no_rules_desc')}</p>
                </div>
            ) : (
                <div className="grid gap-3.5">
                    {rules.map(rule => (
                        <motion.div
                            key={rule.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`nx-glass-card p-5 flex items-center justify-between transition-all ${
                                rule.isActive ? "" : "opacity-65 grayscale"
                            }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${
                                    rule.isActive ? "bg-sky-500/12 border-sky-500/20 text-sky-700" : "bg-slate-100 border-slate-200 text-slate-400"
                                }`}>
                                    <Bot className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-base">{rule.name}</h3>
                                    <div className="text-xs font-mono text-slate-600 mt-1 flex flex-wrap items-center gap-2">
                                        <span className="bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 text-slate-700">
                                            IF {JSON.parse(rule.condition).field} {JSON.parse(rule.condition).operator} {JSON.parse(rule.condition).value}
                                        </span>
                                        <span className="text-slate-400">➜</span>
                                        <span className="bg-emerald-500/12 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-semibold">
                                            {JSON.parse(rule.action).type}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-5">
                                <div className="text-right hidden md:block">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Last Triggered</p>
                                    <p className="text-xs font-medium text-slate-700 tabular-nums">
                                        {rule.lastTriggered ? new Date(rule.lastTriggered).toLocaleString() : 'Never'}
                                    </p>
                                </div>

                                <button
                                    onClick={() => toggleRule(rule)}
                                    className={`relative w-13 h-7 rounded-full transition-colors ${
                                        rule.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                                    }`}
                                >
                                    <motion.div
                                        className="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm"
                                        animate={{ x: rule.isActive ? 24 : 0 }}
                                    />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
            </div>
        </div>
    );
}
