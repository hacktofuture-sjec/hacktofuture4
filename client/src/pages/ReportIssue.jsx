import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Send, MapPin, Camera, Type, CheckCircle2, Trophy, Navigation, Loader2, PhoneCall } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VoiceCallButton from '../components/VoiceCallButton';


const ReportIssue = () => {
    const [formData, setFormData] = useState({ title: '', text: '', location: '', imageUrl: '', lat: null, lng: null });
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [locating, setLocating] = useState(false);
    const [result, setResult] = useState(null);
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();

    const CLOUDINARY_UPLOAD_PRESET = "dbmsproject";
    const CLOUDINARY_CLOUD_NAME = "dyp7pxrli";

    useEffect(() => {
        // Auto-detect GPS location on mount
        getLocation();
    }, []);

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const uploadToast = toast.loading('Uploading evidence to Cloudinary...');
        
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
                setFormData(prev => ({ ...prev, imageUrl: fileData.secure_url }));
                toast.success('Image Verified & Uploaded', { id: uploadToast });
            } else {
                throw new Error('Upload error');
            }
        } catch (err) {
            toast.error('Cloudinary Upload Failed', { id: uploadToast });
        } finally {
            setUploading(false);
        }
    };

    const getLocation = () => {
        if (!navigator.geolocation) {
            return toast.error('Geolocation is not supported by your browser');
        }
        setLocating(true);
        const gpsToast = toast.loading('Acquiring precise GPS location & address...');

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, {
                        headers: { 'User-Agent': 'JanSetu-SmartCity-App' }
                    });
                    const data = await response.json();
                    
                    const fullAddress = data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

                    setFormData(prev => ({ 
                        ...prev, 
                        location: fullAddress, 
                        lat: latitude, 
                        lng: longitude 
                    }));
                    toast.success('GPS Address Locked! 📍', { id: gpsToast });
                } catch (err) {
                    const fallback = `Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                    setFormData(prev => ({ 
                        ...prev, 
                        location: fallback, 
                        lat: latitude, 
                        lng: longitude 
                    }));
                    toast.success('GPS Coordinates Locked! 📍', { id: gpsToast });
                } finally {
                    setLocating(false);
                }
            },
            (err) => {
                setLocating(false);
                toast.error('Location permission needed. Please allow GPS access.', { id: gpsToast });
            },
            options
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title) return toast.error('Title is required');
        
        setLoading(true);
        const processingToast = toast.loading('Synchronizing with JanSetu AI Matrix...');
        try {
            const payload = { ...formData, text: formData.title };
            
            const { data } = await axios.post(
                'http://localhost:5000/api/complaints', 
                payload,
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
            
            setResult(data.data);
            if (refreshUser) await refreshUser();
            toast.success('Issue Logged. +10 Reward Points!', { id: processingToast });
        } catch (err) {
            toast.error('Submission failed.', { id: processingToast });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen pt-20 sm:pt-28 pb-28 sm:pb-20 bg-slate-50">
            <div className="container mx-auto px-4 sm:px-6">
                <AnimatePresence mode="wait">
                    {!result ? (
                        <motion.div 
                            key="form" 
                            initial={{ opacity: 0, scale: 0.98 }} 
                            animate={{ opacity: 1, scale: 1 }} 
                            className="max-w-4xl mx-auto flex flex-col lg:flex-row gap-8 lg:gap-12"
                        >
                            {/* Left Side Header */}
                            <div className="flex-1 lg:pt-8">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-brand-blue rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider mb-4 border border-blue-100">
                                    <Send size={13} /> Grievance Submission
                                </div>
                                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight mb-4 sm:mb-6">
                                    Report <br/> <span className="text-brand-blue">Awareness.</span>
                                </h1>
                                <p className="text-slate-500 font-medium text-xs sm:text-base mb-6 sm:mb-8 leading-relaxed">
                                    Upload a photo and provide a title. Our AI neural routing handles automated classification, department assignment, and SLA tracking.
                                </p>
                                
                                <div className="card-premium p-4 sm:p-6 border-none shadow-blue-500/5 bg-blue-50/70 rounded-2xl sm:rounded-3xl">
                                    <div className="flex items-center gap-3 mb-2 sm:mb-3">
                                        <Trophy className="text-brand-orange" size={20} />
                                        <h4 className="font-black text-slate-800 uppercase tracking-wider text-xs">Citizen Reward</h4>
                                    </div>
                                    <p className="text-slate-600 text-xs sm:text-sm font-medium leading-relaxed">
                                        Earn JanSetu loyalty reward points for photographic evidence contributing to city maintenance and safety.
                                    </p>
                                </div>

                                <div className="mt-4 p-4 sm:p-6 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200/80 rounded-2xl sm:rounded-3xl shadow-sm">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
                                            <PhoneCall size={18} className="animate-bounce" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-900 text-xs sm:text-sm">Prefer Speaking?</h4>
                                            <p className="text-emerald-700 text-[10px] sm:text-xs font-semibold">Instant AI Voice Helpline</p>
                                        </div>
                                    </div>
                                    <p className="text-slate-600 text-xs mb-3">
                                        Report civic issues hands-free in seconds by talking to our live Voice AI Officer.
                                    </p>
                                    <VoiceCallButton isFloating={false} />
                                </div>
                            </div>


                            {/* Form Card */}
                            <form onSubmit={handleSubmit} className="flex-[1.4] card-premium p-5 sm:p-10 space-y-6 sm:space-y-8 bg-white rounded-3xl shadow-lg border border-slate-100">
                                <div className="space-y-2">
                                    <label className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider ml-1">
                                        Grievance Title
                                    </label>
                                    <div className="relative">
                                        <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input 
                                            required 
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:border-brand-blue focus:bg-white transition-all placeholder:text-slate-400" 
                                            placeholder="Example: Broken Street Lamp or Open Pothole"
                                            value={formData.title} 
                                            onChange={e => setFormData({...formData, title: e.target.value})}
                                        />
                                    </div>
                                </div>

                                {/* Location with GPS */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <label className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                                            <MapPin size={13} className="text-brand-blue" /> Verified GPS Location
                                        </label>
                                        <button 
                                            type="button"
                                            onClick={getLocation}
                                            disabled={locating}
                                            className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-brand-blue hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg sm:rounded-xl border border-blue-100 transition-all active:scale-95 flex-shrink-0"
                                        >
                                            {locating ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                                            {locating ? 'Acquiring GPS...' : 'Re-detect GPS'}
                                        </button>
                                    </div>

                                    <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                                        {locating ? (
                                            <div className="flex items-center gap-3 text-slate-500 py-1.5">
                                                <Loader2 className="animate-spin text-brand-blue flex-shrink-0" size={18} />
                                                <div>
                                                    <p className="text-xs font-bold text-slate-700">Connecting to GPS Satellites...</p>
                                                    <p className="text-[10px] text-slate-400">Fetching high-accuracy street address</p>
                                                </div>
                                            </div>
                                        ) : formData.location ? (
                                            <div>
                                                <div className="flex items-start gap-2 mb-1.5">
                                                    <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                                                    <p className="text-xs font-bold text-slate-800 leading-relaxed">
                                                        {formData.location}
                                                    </p>
                                                </div>
                                                {formData.lat && formData.lng && (
                                                    <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-200/60 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider flex-wrap">
                                                        <span className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-brand-blue">
                                                            LAT: {formData.lat.toFixed(5)}°
                                                        </span>
                                                        <span className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-brand-blue">
                                                            LNG: {formData.lng.toFixed(5)}°
                                                        </span>
                                                        <span className="text-emerald-600 font-bold ml-auto flex items-center gap-1">
                                                            ● GPS Auto-Locked
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between py-1">
                                                <p className="text-xs text-slate-400">Location not yet acquired</p>
                                                <button 
                                                    type="button" 
                                                    onClick={getLocation} 
                                                    className="text-xs font-bold text-brand-blue underline"
                                                >
                                                    Tap to Fetch GPS
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Photo Upload */}
                                <div className="space-y-3">
                                    <label className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider ml-1">
                                        Evidence Photo
                                    </label>
                                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl p-6 sm:p-8 hover:border-brand-blue transition-colors relative group">
                                        {formData.imageUrl ? (
                                            <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-md">
                                                <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                                <button 
                                                    type="button"
                                                    onClick={() => setFormData({...formData, imageUrl: ''})}
                                                    className="absolute top-2 right-2 px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-red-700"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <Camera size={36} className="text-slate-300 mb-2 group-hover:text-brand-blue transition-colors" />
                                                <p className="text-slate-500 font-bold text-xs sm:text-sm mb-1 text-center">Tap to capture or upload photo</p>
                                                <p className="text-slate-400 text-[10px] sm:text-xs">Camera or Gallery (JPEG, PNG)</p>
                                                <input 
                                                    type="file" 
                                                    accept="image/*"
                                                    onChange={handleImageUpload}
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                />
                                                {uploading && (
                                                    <div className="absolute inset-0 bg-white/85 flex items-center justify-center rounded-3xl backdrop-blur-xs">
                                                        <Loader2 className="animate-spin text-brand-blue" size={28} />
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                <button 
                                    disabled={loading || uploading} 
                                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                                >
                                    {loading ? 'Analyzing with AI...' : 'Submit Grievance Report'}
                                </button>
                            </form>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="result" 
                            initial={{ opacity: 0, scale: 0.95 }} 
                            animate={{ opacity: 1, scale: 1 }} 
                            className="max-w-xl mx-auto card-premium p-8 sm:p-12 text-center bg-white rounded-3xl shadow-xl border border-slate-100"
                        >
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-50 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-md shadow-emerald-200/50">
                                <CheckCircle2 size={36} />
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-2">Report Logged!</h2>
                            <p className="text-slate-400 font-bold mb-8 uppercase text-[10px] sm:text-xs tracking-wider">Status: Dispatched via AI Routing</p>
                            
                            <div className="grid grid-cols-2 gap-3 sm:gap-4 text-left mb-8">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Assigned To</p>
                                    <p className="text-sm sm:text-base font-black text-brand-blue truncate">{result.department}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">AI Priority</p>
                                    <p className="text-sm sm:text-base font-black text-brand-orange">{result.priority}</p>
                                </div>
                            </div>

                            <button 
                                onClick={() => navigate('/citizen')} 
                                className="w-full py-4 bg-brand-blue text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                            >
                                Back to My Citizen Portal
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ReportIssue;
