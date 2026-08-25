import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
    X, 
    Camera, 
    ShieldCheck, 
    AlertTriangle, 
    Loader2, 
    UploadCloud, 
    CheckCircle2, 
    Sparkles 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ResolveModal = ({ complaint, isOpen, onClose, onSuccess, token }) => {
    const [resolutionImage, setResolutionImage] = useState('');
    const [note, setNote] = useState('');
    const [uploading, setUploading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [auditError, setAuditError] = useState(null);

    const CLOUDINARY_UPLOAD_PRESET = "dbmsproject";
    const CLOUDINARY_CLOUD_NAME = "dyp7pxrli";

    if (!isOpen || !complaint) return null;

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        setAuditError(null);
        const uploadToast = toast.loading('Uploading resolution photo...');
        
        const data = new FormData();
        data.append('file', file);
        data.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: data
            });
            const fileData = await res.json();
            if (fileData.secure_url) {
                setResolutionImage(fileData.secure_url);
                toast.success('Resolution photo uploaded!', { id: uploadToast });
            } else {
                throw new Error('Upload error');
            }
        } catch (err) {
            toast.error('Cloudinary upload failed. You can paste an image link directly.', { id: uploadToast });
        } finally {
            setUploading(false);
        }
    };

    const handleRunAIVerification = async (e) => {
        e.preventDefault();
        if (!resolutionImage) {
            return toast.error('Please upload a resolution photo as proof of work.');
        }

        setVerifying(true);
        setAuditError(null);
        const scanToast = toast.loading('AI inspecting resolution photo...');

        try {
            const response = await axios.post(
                `http://localhost:5000/api/complaints/${complaint._id}/resolve`,
                {
                    resolutionImageUrl: resolutionImage,
                    resolutionNote: note
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            toast.success(response.data.message || 'AI verified resolution! Ticket closed.', { id: scanToast });
            onSuccess();
            onClose();
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Verification failed';
            setAuditError(errorMsg);
            toast.error('AI Inspection Alert: Closure Rejected', { id: scanToast });
        } finally {
            setVerifying(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]"
            >
                {/* Modal Header */}
                <div className="px-5 py-4 sm:px-8 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-brand-blue/10 text-brand-blue flex items-center justify-center">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">Resolve Complaint</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">AI Anti-Fraud Verification</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-4 sm:p-8 overflow-y-auto space-y-4 sm:space-y-6">
                    {/* Complaint Summary */}
                    <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 border border-slate-100 flex gap-3 sm:gap-4 items-center">
                        {complaint.imageUrl ? (
                            <img src={complaint.imageUrl} alt="Original issue" className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-slate-200 flex-shrink-0" />
                        ) : (
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 text-[10px] font-bold text-center p-1 flex-shrink-0">
                                No Photo
                            </div>
                        )}
                        <div className="min-w-0">
                            <span className="text-[9px] sm:text-[10px] font-black text-brand-blue uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-md">
                                {complaint.category || 'Civic Issue'}
                            </span>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-1 mt-1">{complaint.title}</h4>
                            <p className="text-[11px] text-slate-400 truncate">{complaint.location || 'Local territory'}</p>
                        </div>
                    </div>

                    {/* Audit Alert */}
                    <AnimatePresence>
                        {auditError && (
                            <motion.div 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-3.5 rounded-2xl bg-red-50 border border-red-200 flex gap-2.5 items-start"
                            >
                                <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                                <div>
                                    <p className="text-xs font-black text-red-900 uppercase tracking-wide">Verification Failed</p>
                                    <p className="text-xs text-red-700 font-medium mt-0.5">{auditError}</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Image Upload Area */}
                    <div>
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                            Proof of Work Photo (Required for AI Scan)
                        </label>
                        
                        {resolutionImage ? (
                            <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/40 bg-slate-50 group h-40 sm:h-48">
                                <img src={resolutionImage} alt="Uploaded Proof" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <label className="px-3.5 py-2 bg-white text-slate-800 text-xs font-bold rounded-xl cursor-pointer shadow hover:bg-slate-50">
                                        Change Photo
                                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                    </label>
                                </div>
                                <span className="absolute bottom-2.5 left-2.5 bg-emerald-600 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shadow">
                                    ✓ Ready for AI Scan
                                </span>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center h-36 sm:h-44 border-2 border-dashed border-slate-200 hover:border-brand-blue rounded-2xl bg-slate-50/50 hover:bg-blue-50/30 transition-all cursor-pointer group p-4">
                                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                {uploading ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="animate-spin text-brand-blue" size={28} />
                                        <p className="text-xs font-bold text-slate-500">Uploading photo...</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-100 text-brand-blue flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
                                            <UploadCloud size={20} />
                                        </div>
                                        <p className="text-xs sm:text-sm font-bold text-slate-700 text-center">Click or Tap to Upload Resolution Photo</p>
                                        <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 font-medium">Camera or Gallery (JPEG, PNG, WebP)</p>
                                    </>
                                )}
                            </label>
                        )}

                        {/* Direct URL input */}
                        <div className="mt-2.5">
                            <input 
                                type="text"
                                placeholder="Or paste image URL directly..."
                                value={resolutionImage}
                                onChange={(e) => setResolutionImage(e.target.value)}
                                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-blue text-slate-700"
                            />
                        </div>
                    </div>

                    {/* Official's Note */}
                    <div>
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                            Work Summary / Action Taken (Optional)
                        </label>
                        <textarea 
                            rows={2}
                            placeholder="e.g., Pothole filled with bitumen mix, garbage cleared and sanitized..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full p-3 text-xs font-medium bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue text-slate-800 resize-none"
                        />
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2.5 sm:gap-3 flex-shrink-0">
                    <button 
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                        disabled={verifying}
                    >
                        Cancel
                    </button>
                    <button 
                        type="button"
                        onClick={handleRunAIVerification}
                        disabled={verifying || uploading || !resolutionImage}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-white shadow-lg transition-all ${
                            verifying || uploading || !resolutionImage
                                ? 'bg-slate-300 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 active:scale-95'
                        }`}
                    >
                        {verifying ? (
                            <>
                                <Loader2 className="animate-spin" size={14} /> AI Scanning...
                            </>
                        ) : (
                            <>
                                <Sparkles size={14} /> Verify & Close
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default ResolveModal;
