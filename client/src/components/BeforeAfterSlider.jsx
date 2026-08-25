import React, { useState, useRef } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';

const BeforeAfterSlider = ({ 
    beforeImage, 
    afterImage, 
    verificationStatus = 'Verified', 
    verificationScore = 85, 
    verificationVerdict = 'Resolved cleanly.', 
    fraudAuditFlag = false 
}) => {
    const [sliderPos, setSliderPos] = useState(50);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef(null);

    const handleMove = (clientX) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setSliderPos(percent);
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        handleMove(e.clientX);
    };

    const handleTouchMove = (e) => {
        if (!e.touches || !e.touches[0]) return;
        handleMove(e.touches[0].clientX);
    };

    // If only after image is available
    if (!beforeImage && afterImage) {
        return (
            <div className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 shadow-xs mb-3">
                <div className="relative h-44 sm:h-52 w-full bg-slate-100">
                    <img src={afterImage} alt="Resolution" className="w-full h-full object-cover" />
                    <span className="absolute top-2.5 right-2.5 px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider shadow">
                        Proof of Work
                    </span>
                </div>
                {renderAuditBox(verificationStatus, verificationScore, verificationVerdict, fraudAuditFlag)}
            </div>
        );
    }

    if (!beforeImage && !afterImage) return null;

    return (
        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs mb-3">
            {/* Interactive Slider Area */}
            {beforeImage && afterImage ? (
                <div 
                    ref={containerRef}
                    className="relative h-44 sm:h-52 w-full select-none cursor-ew-resize overflow-hidden bg-slate-100 touch-none"
                    onMouseDown={() => setIsDragging(true)}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseLeave={() => setIsDragging(false)}
                    onMouseMove={handleMouseMove}
                    onTouchStart={() => setIsDragging(true)}
                    onTouchEnd={() => setIsDragging(false)}
                    onTouchMove={handleTouchMove}
                >
                    {/* After Image (Background / Full Width) */}
                    <img 
                        src={afterImage} 
                        alt="After (Resolved)" 
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none" 
                    />
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-emerald-600/90 backdrop-blur-md text-white rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider pointer-events-none shadow">
                        After (Resolved)
                    </span>

                    {/* Before Image (Clipped / Foreground) */}
                    <div 
                        className="absolute inset-0 overflow-hidden pointer-events-none"
                        style={{ width: `${sliderPos}%` }}
                    >
                        <img 
                            src={beforeImage} 
                            alt="Before (Reported Issue)" 
                            className="absolute inset-0 w-full h-full object-cover max-w-none"
                            style={{ 
                                width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%',
                                height: '100%' 
                            }}
                        />
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-slate-900/90 backdrop-blur-md text-white rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider pointer-events-none shadow">
                            Before (Reported)
                        </span>
                    </div>

                    {/* Draggable Divider Handle */}
                    <div 
                        className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)] flex items-center justify-center pointer-events-none"
                        style={{ left: `${sliderPos}%` }}
                    >
                        <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white text-slate-800 rounded-full shadow-lg border-2 border-brand-blue flex items-center justify-center text-[10px] font-black">
                            ↔
                        </div>
                    </div>
                </div>
            ) : (
                <div className="relative h-40 sm:h-48 w-full bg-slate-100">
                    <img src={beforeImage} alt="Complaint Evidence" className="w-full h-full object-cover" />
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-1 bg-slate-900/80 text-white rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
                        Evidence Photo
                    </span>
                </div>
            )}

            {/* AI Verification Verdict Banner */}
            {afterImage && renderAuditBox(verificationStatus, verificationScore, verificationVerdict, fraudAuditFlag)}
        </div>
    );
};

const renderAuditBox = (status, score, verdict, isFlagged) => {
    const isPassed = status === 'Verified' && !isFlagged;

    return (
        <div className={`p-3 sm:p-4 border-t ${isPassed ? 'bg-emerald-50/70 border-emerald-100' : 'bg-red-50/70 border-red-100'}`}>
            <div className="flex items-center justify-between mb-1 gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    {isPassed ? (
                        <>
                            <ShieldCheck size={15} className="text-emerald-600 flex-shrink-0" />
                            <span className="text-[11px] sm:text-xs font-black text-emerald-800 uppercase tracking-wider truncate">
                                AI Verified Resolution
                            </span>
                        </>
                    ) : (
                        <>
                            <AlertTriangle size={15} className="text-red-600 flex-shrink-0" />
                            <span className="text-[11px] sm:text-xs font-black text-red-800 uppercase tracking-wider truncate">
                                AI Audit Warning
                            </span>
                        </>
                    )}
                </div>
                {score > 0 && (
                    <span className={`text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${isPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {score}% Match
                    </span>
                )}
            </div>
            <p className={`text-[11px] sm:text-xs font-medium leading-relaxed ${isPassed ? 'text-emerald-950' : 'text-red-950'}`}>
                {verdict || (isPassed ? 'The fix was inspected and verified by AI.' : 'Issue unresolved or flagged for audit.')}
            </p>
        </div>
    );
};

export default BeforeAfterSlider;
