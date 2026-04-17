import { useState, useRef, useEffect } from 'react';
import { useCattleStore, CowStatus, Cow } from '../store/cattleStore';
import {
  ChevronRight, CheckCircle, AlertTriangle, Eye, Upload, Play,
  Thermometer, Activity, RotateCcw, Tag, Zap
} from 'lucide-react';

type Step = 1 | 2 | 3 | 4;

interface Symptom {
  id: string;
  label: string;
  description: string;
  weight: number;
}

const SYMPTOMS: Symptom[] = [
  { id: 'restlessness', label: 'Restlessness', description: 'Cow appears agitated, moving frequently', weight: 2 },
  { id: 'mounting', label: 'Mounting Behavior', description: 'Attempting to mount or being mounted', weight: 4 },
  { id: 'swollen_vulva', label: 'Swollen Vulva', description: 'Visible swelling of vulva area', weight: 3 },
  { id: 'discharge', label: 'Mucus Discharge', description: 'Clear or cloudy mucus discharge', weight: 3 },
  { id: 'reduced_appetite', label: 'Reduced Appetite', description: 'Eating less than normal', weight: 1 },
  { id: 'tail_raising', label: 'Tail Raising', description: 'Frequently raising tail', weight: 2 },
  { id: 'vocalization', label: 'Increased Vocalization', description: 'Mooing more than usual', weight: 2 },
  { id: 'chin_resting', label: 'Chin Resting', description: 'Resting chin on other cows', weight: 2 },
  { id: 'decreased_milk', label: 'Decreased Milk Yield', description: 'Drop in milk production', weight: 1 },
];

const CCTV_DETECTIONS = [
  { tagId: 'KA-1023', event: 'Mounting behavior detected', confidence: 93 },
  { tagId: 'KA-1024', event: 'Increased movement detected', confidence: 87 },
  { tagId: 'KA-1025', event: 'Restlessness observed', confidence: 82 },
  { tagId: 'KA-1026', event: 'Tag detected, tail raising', confidence: 78 },
  { tagId: 'KA-1027', event: 'Vocalization increased', confidence: 75 },
];

function getYouTubeEmbedUrl(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ];
  for (const pat of patterns) {
    const m = url.match(pat);
    if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=0`;
  }
  return null;
}

function computeStatus(score: number): CowStatus {
  if (score >= 8) return 'Heat';
  if (score >= 4) return 'Monitor';
  return 'Healthy';
}

interface CCTVDetection {
  tagId: string;
  event: string;
  confidence: number;
  timestamp: string;
}

export default function ManualCheckIn() {
  const cows = useCattleStore((s) => s.cows);
  const addAlert = useCattleStore((s) => s.addAlert);
  const updateCowStatus = useCattleStore((s) => s.updateCowStatus);

  const [step, setStep] = useState<Step>(1);
  const [selectedCow, setSelectedCow] = useState<Cow | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(new Set());
  const [cctvVideoType, setCctvVideoType] = useState<'upload' | 'youtube'>('upload');
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const [youtubeInput, setYoutubeInput] = useState('');
  const [youtubeEmbed, setYoutubeEmbed] = useState<string | null>(null);
  const [cctvDetections, setCctvDetections] = useState<CCTVDetection[]>([]);
  const [detectionRunning, setDetectionRunning] = useState(false);
  const [finalResult, setFinalResult] = useState<{
    status: CowStatus;
    symptomScore: number;
    cctvScore: number;
    hybridScore: number;
    details: string[];
  } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const detectionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const symptomScore = SYMPTOMS.filter((s) => selectedSymptoms.has(s.id)).reduce((acc, s) => acc + s.weight, 0);

  const runCCTVDetection = () => {
    if (detectionRunning) return;
    setDetectionRunning(true);
    setCctvDetections([]);

    let count = 0;
    detectionTimerRef.current = setInterval(() => {
      const detection = CCTV_DETECTIONS[Math.floor(Math.random() * CCTV_DETECTIONS.length)];
      setCctvDetections((prev) => [
        ...prev,
        {
          ...detection,
          timestamp: new Date().toLocaleTimeString('en-IN'),
        },
      ].slice(0, 10));
      count++;
      if (count >= 4) {
        clearInterval(detectionTimerRef.current!);
        setDetectionRunning(false);
      }
    }, 1500);
  };

  useEffect(() => {
    if (uploadedVideo || youtubeEmbed) {
      setTimeout(runCCTVDetection, 1000);
    }
  }, [uploadedVideo, youtubeEmbed]);

  useEffect(() => {
    return () => {
      if (detectionTimerRef.current) clearInterval(detectionTimerRef.current);
    };
  }, []);

  const cctvScore = cctvDetections.reduce((acc, d) => {
    if (d.event.includes('Mounting')) return acc + 4;
    if (d.event.includes('movement') || d.event.includes('Restlessness')) return acc + 2;
    if (d.event.includes('Vocalization') || d.event.includes('tail')) return acc + 1;
    return acc + 0.5;
  }, 0);

  const handleGenerateResult = () => {
    const hybridScore = symptomScore + Math.min(cctvScore, 8);
    const status = computeStatus(hybridScore);

    const details: string[] = [
      `Manual symptom score: ${symptomScore} points`,
      `CCTV detection score: ${cctvScore.toFixed(1)} points`,
      `Hybrid total score: ${hybridScore.toFixed(1)} / 20`,
    ];

    if (selectedSymptoms.has('mounting')) details.push('Critical: Mounting behavior confirmed by manual observation');
    if (cctvDetections.some((d) => d.event.includes('Mounting'))) details.push('Critical: Mounting behavior detected by CCTV');

    setFinalResult({ status, symptomScore, cctvScore, hybridScore, details });
    setStep(4);

    if (selectedCow && status !== 'Healthy') {
      updateCowStatus(selectedCow.id, status);
      addAlert({
        cowId: selectedCow.id,
        cowName: selectedCow.name,
        tagId: selectedCow.tagId,
        message: `Manual check-in result for ${selectedCow.name} (Tag ${selectedCow.tagId}): ${status} status with hybrid score ${hybridScore.toFixed(1)}/20. ${status === 'Heat' ? 'Immediate veterinary attention required.' : 'Close monitoring recommended.'}`,
        status,
        source: 'Manual',
      });
    }
  };

  const reset = () => {
    setStep(1);
    setSelectedCow(null);
    setSelectedSymptoms(new Set());
    setCctvVideoType('upload');
    setUploadedVideo(null);
    setYoutubeInput('');
    setYoutubeEmbed(null);
    setCctvDetections([]);
    setDetectionRunning(false);
    setFinalResult(null);
  };

  const steps = [
    { n: 1, label: 'Select Cow' },
    { n: 2, label: 'Symptoms' },
    { n: 3, label: 'CCTV Data' },
    { n: 4, label: 'Result' },
  ];

  const statusConfig: Record<CowStatus, { label: string; color: string; bg: string; border: string; gradient: string; icon: React.ReactNode }> = {
    Heat: {
      label: 'Heat Detected',
      color: 'text-red-700',
      bg: 'bg-red-50',
      border: 'border-red-200',
      gradient: 'from-red-500 to-rose-600',
      icon: <AlertTriangle size={32} className="text-red-500" />,
    },
    Monitor: {
      label: 'Monitor Required',
      color: 'text-yellow-700',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      gradient: 'from-yellow-500 to-amber-600',
      icon: <Eye size={32} className="text-yellow-500" />,
    },
    Healthy: {
      label: 'Healthy / Normal',
      color: 'text-green-700',
      bg: 'bg-green-50',
      border: 'border-green-200',
      gradient: 'from-green-500 to-emerald-600',
      icon: <CheckCircle size={32} className="text-green-500" />,
    },
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manual Check-In</h1>
          <p className="text-slate-500 text-sm mt-1">Step-by-step cattle health assessment workflow</p>
        </div>
        {step > 1 && (
          <button onClick={reset} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm">
            <RotateCcw size={14} />
            Start Over
          </button>
        )}
      </div>

      {/* Step Indicator */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step > s.n
                    ? 'bg-green-500 text-white'
                    : step === s.n
                    ? 'bg-green-600 text-white ring-4 ring-green-100'
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {step > s.n ? <CheckCircle size={16} /> : s.n}
                </div>
                <p className={`text-xs mt-1.5 font-medium ${step >= s.n ? 'text-slate-700' : 'text-slate-400'}`}>
                  {s.label}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 mb-5 rounded ${step > s.n ? 'bg-green-400' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: Select Cow */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Step 1: Select Cow</h2>
            <p className="text-sm text-slate-500 mt-0.5">Choose the cow you want to assess</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cows.map((cow) => (
                <button
                  key={cow.id}
                  onClick={() => setSelectedCow(cow)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedCow?.id === cow.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-200 hover:border-green-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                      selectedCow?.id === cow.id ? 'bg-green-200 text-green-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {cow.name[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{cow.name}</p>
                      <p className="text-xs text-slate-500">#{cow.id} · {cow.tagId}</p>
                    </div>
                    {selectedCow?.id === cow.id && (
                      <CheckCircle size={18} className="text-green-500 ml-auto" />
                    )}
                  </div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{cow.breed}</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{cow.age}y</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                disabled={!selectedCow}
                onClick={() => setStep(2)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors"
              >
                Next: Symptoms
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Symptoms */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-800">Step 2: Symptoms</h2>
                <p className="text-sm text-slate-500 mt-0.5">Select all observed symptoms for {selectedCow?.name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Symptom Score</p>
                <p className={`text-2xl font-bold ${symptomScore >= 8 ? 'text-red-600' : symptomScore >= 4 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {symptomScore}/20
                </p>
              </div>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SYMPTOMS.map((symptom) => {
                const selected = selectedSymptoms.has(symptom.id);
                return (
                  <button
                    key={symptom.id}
                    onClick={() => {
                      const next = new Set(selectedSymptoms);
                      if (selected) next.delete(symptom.id);
                      else next.add(symptom.id);
                      setSelectedSymptoms(next);
                    }}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selected
                        ? 'border-red-400 bg-red-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`font-medium text-sm ${selected ? 'text-red-700' : 'text-slate-700'}`}>
                          {symptom.label}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{symptom.description}</p>
                      </div>
                      <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selected ? 'border-red-400 bg-red-400' : 'border-slate-300'
                      }`}>
                        {selected && <span className="text-white text-xs font-bold">✓</span>}
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        symptom.weight >= 4 ? 'bg-red-100 text-red-600' :
                        symptom.weight >= 2 ? 'bg-yellow-100 text-yellow-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        +{symptom.weight} pts
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Score display */}
            <div className={`mt-4 p-4 rounded-xl ${symptomScore >= 8 ? 'bg-red-50 border border-red-200' : symptomScore >= 4 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Thermometer size={16} className={symptomScore >= 8 ? 'text-red-500' : symptomScore >= 4 ? 'text-yellow-500' : 'text-green-500'} />
                  <span className={`text-sm font-semibold ${symptomScore >= 8 ? 'text-red-700' : symptomScore >= 4 ? 'text-yellow-700' : 'text-green-700'}`}>
                    Preliminary status: {computeStatus(symptomScore)}
                  </span>
                </div>
                <span className={`text-sm font-bold ${symptomScore >= 8 ? 'text-red-600' : symptomScore >= 4 ? 'text-yellow-600' : 'text-green-600'}`}>
                  Score: {symptomScore}
                </span>
              </div>
            </div>

            <div className="flex justify-between mt-5">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 px-4 py-2.5 rounded-xl border border-slate-200 text-sm">
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors"
              >
                Next: CCTV Data
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: CCTV Data */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Step 3: CCTV Data</h2>
              <p className="text-sm text-slate-500 mt-0.5">Add video evidence to enhance accuracy</p>
            </div>
            <div className="p-5 space-y-4">
              {/* Video Input Toggle */}
              <div className="flex gap-3">
                <button
                  onClick={() => setCctvVideoType('upload')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    cctvVideoType === 'upload' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Upload size={14} />
                  Upload Video
                </button>
                <button
                  onClick={() => setCctvVideoType('youtube')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    cctvVideoType === 'youtube' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Play size={14} />
                  YouTube Link
                </button>
              </div>

              {/* Upload Video */}
              {cctvVideoType === 'upload' && (
                <div>
                  {!uploadedVideo ? (
                    <div
                      className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors"
                      onClick={() => fileRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (file && file.type.startsWith('video/')) {
                          setUploadedVideo(URL.createObjectURL(file));
                        }
                      }}
                    >
                      <Upload size={36} className="text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-600 font-medium">Drop video or click to upload</p>
                      <p className="text-slate-400 text-sm mt-1">MP4, MOV, AVI — AI detection runs automatically</p>
                      <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setUploadedVideo(URL.createObjectURL(file));
                      }} />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative rounded-xl overflow-hidden aspect-video bg-black">
                        <video src={uploadedVideo} controls autoPlay muted className="w-full h-full object-contain" />
                        <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 px-3 py-1 rounded-full">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-green-400 text-xs font-mono">ANALYZING...</span>
                        </div>
                      </div>
                      <button onClick={() => { setUploadedVideo(null); setCctvDetections([]); }}
                        className="text-sm text-red-500 hover:text-red-700">
                        Remove video
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* YouTube */}
              {cctvVideoType === 'youtube' && (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Paste YouTube URL..."
                      value={youtubeInput}
                      onChange={(e) => setYoutubeInput(e.target.value)}
                      className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      onClick={() => {
                        const embed = getYouTubeEmbedUrl(youtubeInput);
                        if (embed) setYoutubeEmbed(embed);
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium"
                    >
                      Load
                    </button>
                  </div>
                  {youtubeEmbed && (
                    <div className="relative rounded-xl overflow-hidden aspect-video">
                      <iframe src={youtubeEmbed} className="w-full h-full" allowFullScreen />
                      <button
                        onClick={() => { setYoutubeEmbed(null); setYoutubeInput(''); setCctvDetections([]); }}
                        className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Run detection button */}
              {(uploadedVideo || youtubeEmbed) && (
                <button
                  onClick={runCCTVDetection}
                  disabled={detectionRunning}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2.5 rounded-xl text-sm font-medium"
                >
                  {detectionRunning ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Detecting...
                    </>
                  ) : (
                    <>
                      <Zap size={14} />
                      Re-run Detection
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Detection Results */}
          {cctvDetections.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Activity size={18} className="text-blue-500" />
                  CCTV Detection Results
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Score: {cctvScore.toFixed(1)} pts from video analysis</p>
              </div>
              <div className="p-4 space-y-2">
                {cctvDetections.map((d, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border text-sm ${
                    d.event.includes('Mounting') ? 'bg-red-50 border-red-100' :
                    d.event.includes('movement') || d.event.includes('Restlessness') ? 'bg-yellow-50 border-yellow-100' :
                    'bg-blue-50 border-blue-100'
                  }`}>
                    <Tag size={14} className="text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-xs font-bold text-blue-600">{d.tagId}</span>
                      <span className="text-slate-600 mx-2">·</span>
                      <span className={d.event.includes('Mounting') ? 'text-red-700' : d.event.includes('movement') ? 'text-yellow-700' : 'text-blue-700'}>{d.event}</span>
                    </div>
                    <span className="text-xs text-slate-400">{d.confidence}%</span>
                    <span className="text-xs text-slate-400">{d.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Score summary */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-800 mb-3">Score Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xl font-bold text-slate-700">{symptomScore}</p>
                <p className="text-xs text-slate-500 mt-1">Manual Score</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xl font-bold text-blue-700">{cctvScore.toFixed(1)}</p>
                <p className="text-xs text-blue-500 mt-1">CCTV Score</p>
              </div>
              <div className={`rounded-xl p-3 ${
                (symptomScore + Math.min(cctvScore, 8)) >= 8 ? 'bg-red-50' :
                (symptomScore + Math.min(cctvScore, 8)) >= 4 ? 'bg-yellow-50' : 'bg-green-50'
              }`}>
                <p className={`text-xl font-bold ${
                  (symptomScore + Math.min(cctvScore, 8)) >= 8 ? 'text-red-600' :
                  (symptomScore + Math.min(cctvScore, 8)) >= 4 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {(symptomScore + Math.min(cctvScore, 8)).toFixed(1)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Hybrid Score</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 px-4 py-2.5 rounded-xl border border-slate-200 text-sm">
              ← Back
            </button>
            <button
              onClick={handleGenerateResult}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors"
            >
              Generate Final Result
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Result */}
      {step === 4 && finalResult && (
        <div className="space-y-4">
          <div className={`bg-white rounded-2xl border-2 ${statusConfig[finalResult.status].border} shadow-sm overflow-hidden`}>
            <div className={`bg-gradient-to-r ${statusConfig[finalResult.status].gradient} p-6`}>
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-xl">
                  {statusConfig[finalResult.status].icon}
                </div>
                <div>
                  <p className="text-white/80 text-sm">Final Assessment for {selectedCow?.name}</p>
                  <h2 className="text-white text-3xl font-bold">{statusConfig[finalResult.status].label}</h2>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Score breakdown */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Hybrid Score Breakdown</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Manual Symptoms</span>
                      <span>{finalResult.symptomScore} pts</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-400 rounded-full" style={{ width: `${(finalResult.symptomScore / 20) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>CCTV Video Detection</span>
                      <span>{Math.min(finalResult.cctvScore, 8).toFixed(1)} pts</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(Math.min(finalResult.cctvScore, 8) / 20) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                      <span>Hybrid Score (Manual + CCTV)</span>
                      <span>{finalResult.hybridScore.toFixed(1)} / 20</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${statusConfig[finalResult.status].gradient}`}
                        style={{ width: `${(finalResult.hybridScore / 20) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className={`${statusConfig[finalResult.status].bg} rounded-xl p-4`}>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Assessment Details</h3>
                <ul className="space-y-1">
                  {finalResult.details.map((d, i) => (
                    <li key={i} className={`text-sm ${statusConfig[finalResult.status].color} flex items-start gap-2`}>
                      <span className="mt-0.5">•</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Cow info */}
              {selectedCow && (
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center font-bold text-green-700">
                    {selectedCow.name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{selectedCow.name}</p>
                    <p className="text-xs text-slate-500">#{selectedCow.id} · {selectedCow.breed} · <span className="font-mono">{selectedCow.tagId}</span></p>
                  </div>
                  <div className="ml-auto">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      finalResult.status === 'Heat' ? 'bg-red-100 text-red-700' :
                      finalResult.status === 'Monitor' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {finalResult.status}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={reset}
                  className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors"
                >
                  New Check-In
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
