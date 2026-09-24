import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { Check, Trash2, RotateCw } from 'lucide-react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { appAlert } from '@/components/ui/MobileDialog';

const SignatureCanvas = dynamic(() => import('react-signature-canvas'), { ssr: false }) as any;

// Maximum smoothness configuration
const MemoizedSignaturePad = memo(({ sigRef, onClear }: { sigRef: any, onClear: () => void }) => {
    const { t } = useLanguage();
    
    // Effect to handle canvas resolution for high-DPI screens
    useEffect(() => {
        const resizeCanvas = () => {
            const canvas = sigRef.current?.getCanvas();
            if (canvas) {
                const ratio = Math.max(window.devicePixelRatio || 1, 2);
                canvas.width = canvas.offsetWidth * ratio;
                canvas.height = canvas.offsetHeight * ratio;
                canvas.getContext("2d")?.scale(ratio, ratio);
                sigRef.current?.clear(); // Need to clear after resize to fix scaling
            }
        };

        window.addEventListener("resize", resizeCanvas);
        // Initial delay to ensure offsetWidth is ready
        const timer = setTimeout(resizeCanvas, 100);
        
        return () => {
            window.removeEventListener("resize", resizeCanvas);
            clearTimeout(timer);
        };
    }, [sigRef]);

    return (
        <div className="flex-1 bg-white relative shadow-inner touch-none overflow-hidden">
            <SignatureCanvas 
                ref={sigRef}
                penColor="black"
                backgroundColor="white"
                // Performance & Smoothness Tuning
                velocityFilterWeight={0} // Raw input for zero lag
                minWidth={1.5} 
                maxWidth={2.5}
                dotSize={2}
                throttle={0} 
                minDistance={0} 
                canvasProps={{ 
                    className: 'w-full h-full cursor-crosshair',
                    style: { touchAction: 'none' }
                }}
            />
            
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none">
                <span className="text-8xl font-black rotate-[-20deg] uppercase">{t('sign_here')}</span>
            </div>

            {/* Floating Clear Button */}
            <button 
                onClick={(e) => {
                    e.preventDefault();
                    onClear();
                }}
                className="absolute top-4 right-4 p-3 bg-slate-100 text-slate-400 rounded-full shadow-md hover:bg-rose-50 hover:text-rose-500 transition-all z-10 active:scale-90"
                title="Clear Signature"
            >
                <Trash2 className="w-5 h-5" />
            </button>
        </div>
    );
});

MemoizedSignaturePad.displayName = 'MemoizedSignaturePad';

interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => Promise<void>;
    docNum: string;
}

export default function SignatureModal({ isOpen, onClose, onSave, docNum }: SignatureModalProps) {
    const { t } = useLanguage();
    const sigCanvasRef = useRef<any>(null);
    const [saving, setSaving] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!isOpen || !mounted) return null;

    const handleClear = () => {
        sigCanvasRef.current?.clear();
    };

    const handleConfirm = async () => {
        if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
            appAlert(t('sign_instruction'));
            return;
        }

        setSaving(true);
        try {
            const dataUrl = sigCanvasRef.current.getTrimmedCanvas().toDataURL('image/jpeg', 0.6);
            await onSave(dataUrl);
            onClose();
        } catch (error) {
            console.error("Signature Save Failed", error);
            appAlert('บันทึกลายเซ็นไม่สำเร็จ กรุณาลองใหม่');
        } finally {
            setSaving(false);
        }
    };

    const modalContent = (
        <div 
            className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Landscape Container */}
            <div className="w-full h-full flex flex-col md:flex-row">
                
                {/* Left/Top Sidebar: Info & Controls */}
                <div className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-6 flex flex-col justify-between shrink-0">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-400 mb-1">
                            <RotateCw className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{t('landscape_mode')}</span>
                        </div>
                        <h2 className="text-xl font-black text-white leading-tight mb-1">{t('sign_title')}</h2>
                        <p className="text-slate-500 text-xs font-mono">{docNum}</p>
                    </div>

                    <div className="hidden md:block space-y-4">
                        <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                            <p className="text-slate-400 text-[10px] font-bold uppercase mb-2">{t('label_usage_tips') || 'TIPS'}</p>
                            <p className="text-slate-300 text-xs leading-relaxed">{t('sign_instruction')}</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 mt-6">
                        <button 
                            onClick={handleConfirm}
                            disabled={saving}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            {saving ? (
                                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Check className="w-5 h-5" />
                                    {t('confirm_signature')}
                                </>
                            )}
                        </button>
                        <button 
                            onClick={onClose}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-2xl font-bold text-xs transition-all active:scale-95"
                        >
                            {t('btn_cancel')}
                        </button>
                    </div>
                </div>

                {/* Main Content: The Canvas */}
                <div className="flex-1 flex flex-col relative bg-white">
                    <MemoizedSignaturePad sigRef={sigCanvasRef} onClear={handleClear} />
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}

