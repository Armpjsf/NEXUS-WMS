
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Plus, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

interface AutomationRule {
    id: string;
    name: string;
    triggerType: 'STOCK_LEVEL' | 'TRANSACTION' | 'SCHEDULE';
    condition: string;
    action: string;
    isActive: boolean;
    lastTriggered?: string;
}

import { useLanguage } from '@/components/providers/LanguageProvider';

export default function RulesPage() {
    const { t } = useLanguage();
    const [rules, setRules] = useState<AutomationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    
    // New Rule Form State
    const [newName, setNewName] = useState("");
    const [triggerType, setTriggerType] = useState<'STOCK_LEVEL'>('STOCK_LEVEL'); // Limit to 1 for now
    
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
        // Toggle Local First
        const updated = { ...rule, isActive: !rule.isActive };
        setRules(rules.map(r => r.id === rule.id ? updated : r));
        
        // Save to Server
        // We reuse the POST endpoint for update if ID exists (handled in backend logic if we send full object)
        // But our backend currently treats POST as UPSERT (SaveRule).
        // So we need to parse the JSON strings back to objects for the API (since API re-stringifies) 
        // OR adjust backend to handle updates better.
        // Actually, the backend:
        // const rule: AutomationRule = { ... condition: JSON.stringify(body.conditionRaw) ... }
        // If we send existing rule, we need to handle the fact that 'condition' is ALREADY a string in 'rule'.
        
        // Let's just re-send the raw parts if we can, OR simply update the isActive flag on the server.
        // To be safe and simple: Let's assume we can just send the 'rule' object but we need to unpack the JSONs to 'Raw' fields
        // because the API expects 'conditionRaw' to stringify it.
        
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
            fetchRules(); // Revert
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:p-8">
            <AmbientBackground />
            <div className="relative z-10 mx-auto max-w-7xl">
            <header className="mb-8 flex flex-col gap-5 overflow-hidden rounded-[1.75rem] border border-indigo-500/30 bg-[#171c23] p-6 shadow-xl shadow-indigo-900/10 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
                <div>
                     <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-indigo-700">Automation Control</p>
                     <h1 className="text-3xl font-black text-[#dee2ec] flex items-center gap-3">
                        <Bot className="w-8 h-8 text-indigo-600" />
                        {t('rules_title')}
                        <span className="px-3 py-1 bg-indigo-500/20 text-indigo-600 text-xs font-bold rounded-full uppercase tracking-wider">Beta</span>
                     </h1>
                     <p className="text-[#8a92a6] mt-2">{t('rules_subtitle')}</p>
                </div>
                <button 
                    onClick={() => setIsCreating(!isCreating)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                >
                    <Plus className="w-5 h-5" />
                    {t('new_rule')}
                </button>
            </header>

            {/* Create Rule Panel */}
            {isCreating && (
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#171c23] rounded-3xl p-8 border border-[#30353d] shadow-xl mb-8"
                >
                    <h2 className="text-xl font-bold text-[#dee2ec] mb-6 flex items-center gap-2">
                        <Save className="w-5 h-5 text-indigo-500" />
                        {t('define_new_rule')}
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left: Trigger */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-[#d1c6ab] mb-2">Rule Name</label>
                                <input 
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="e.g. Low Stock Alert for Electronics"
                                    className="w-full bg-[#1b2027] border border-[#30353d] rounded-xl px-4 py-3 font-bold text-[#d1c6ab] focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            
                            <div className="p-4 bg-[#1b2027] rounded-2xl border border-[#30353d]">
                                <label className="block text-xs font-black text-[#8a92a6] uppercase tracking-wider mb-4">{t('if_condition')}</label>
                                <div className="flex gap-2">
                                    <select disabled className="bg-[#171c23] border border-[#30353d] rounded-lg px-3 py-2 text-sm font-bold text-[#d1c6ab]">
                                        <option>When Stock Level</option>
                                    </select>
                                    <select 
                                        value={condOp}
                                        onChange={e => setCondOp(e.target.value)}
                                        className="bg-[#171c23] border border-[#30353d] rounded-lg px-3 py-2 text-sm font-bold text-indigo-600 text-center w-20"
                                    >
                                        <option value="<">&lt;</option>
                                        <option value=">">&gt;</option>
                                        <option value="==">=</option>
                                    </select>
                                    <input 
                                        type="number"
                                        value={condVal}
                                        onChange={e => setCondVal(e.target.value)}
                                        className="bg-[#171c23] border border-[#30353d] rounded-lg px-3 py-2 text-sm font-bold text-[#d1c6ab] w-24"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right: Action */}
                        <div className="space-y-4">
                            <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 h-full">
                                <label className="block text-xs font-black text-indigo-400 uppercase tracking-wider mb-4">{t('then_action')}</label>
                                <div className="space-y-3">
                                    <select 
                                        value={actionType}
                                        onChange={e => setActionType(e.target.value)}
                                        className="w-full bg-[#171c23] border border-indigo-500/30 rounded-lg px-4 py-3 text-sm font-bold text-indigo-700"
                                    >
                                        <option value="LOG_ALERT">Show Dashboard Alert 🚨</option>
                                        <option value="LINE_NOTIFY" disabled>Send LINE Notify (Coming Soon)</option>
                                        <option value="EMAIL" disabled>Send Email (Coming Soon)</option>
                                    </select>
                                    
                                    <input 
                                        value={actionMsg}
                                        onChange={e => setActionMsg(e.target.value)}
                                        placeholder="Alert Message..."
                                        className="w-full bg-[#171c23] border border-indigo-500/30 rounded-lg px-4 py-3 text-sm font-medium text-[#d1c6ab] focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-4">
                        <button 
                            onClick={() => setIsCreating(false)}
                            className="px-6 py-3 rounded-xl font-bold text-[#8a92a6] hover:bg-[#252a32] transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleCreate}
                            className="px-8 py-3 rounded-xl font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all"
                        >
                            Create Rule
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Rules List */}
            {loading ? (
                <div className="text-center py-12 text-[#8a92a6]">Loading rules...</div>
            ) : rules.length === 0 ? (
                <div className="text-center py-20 bg-[#171c23] rounded-3xl border border-dashed border-[#30353d]">
                    <Bot className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-[#d1c6ab]">{t('no_history')}</h3>
                    <p className="text-[#8a92a6]">{t('no_rules_desc')}</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {rules.map(rule => (
                        <motion.div 
                            key={rule.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-6 rounded-2xl border flex items-center justify-between transition-colors ${
                                rule.isActive 
                                    ? "bg-[#171c23] border-[#30353d] shadow-sm" 
                                    : "bg-[#1b2027] border-[#30353d] opacity-70 grayscale"
                            }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                    rule.isActive ? "bg-indigo-500/20 text-indigo-600" : "bg-[#30353d] text-[#8a92a6]"
                                }`}>
                                    <Bot className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-[#dee2ec] text-lg">{rule.name}</h3>
                                    <div className="text-xs font-mono text-[#8a92a6] mt-1 flex items-center gap-2">
                                        <span className="bg-[#252a32] px-2 py-0.5 rounded border border-[#30353d]">
                                            IF {JSON.parse(rule.condition).field} {JSON.parse(rule.condition).operator} {JSON.parse(rule.condition).value}
                                        </span>
                                        <span className="text-slate-300">➜</span>
                                        <span className="bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded border border-indigo-500/20">
                                            {JSON.parse(rule.action).type}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-6">
                                <div className="text-right hidden md:block">
                                    <p className="text-[10px] font-bold text-[#8a92a6] uppercase tracking-wider">Last Triggered</p>
                                    <p className="text-xs font-medium text-[#d1c6ab]">
                                        {rule.lastTriggered ? new Date(rule.lastTriggered).toLocaleString() : 'Never'}
                                    </p>
                                </div>
                                
                                <button 
                                    onClick={() => toggleRule(rule)}
                                    className={`relative w-14 h-8 rounded-full transition-colors ${
                                        rule.isActive ? 'bg-indigo-500' : 'bg-slate-300'
                                    }`}
                                >
                                    <motion.div 
                                        className="absolute top-1 left-1 w-6 h-6 bg-[#171c23] rounded-full shadow-md"
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
