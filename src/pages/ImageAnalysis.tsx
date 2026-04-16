import { useState, useRef } from 'react';
import { useCattleStore, CowStatus } from '../store/cattleStore';
import { Upload, ScanLine, CheckCircle, AlertTriangle, Eye, Image, RefreshCw } from 'lucide-react';

interface AnalysisResult {
  status: CowStatus;
  confidence: number;
  details: string[];
  recommendation: string;
  processingTime: number;
}

function simulateAnalysis(): Promise<AnalysisResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const rand = Math.random();
      if (rand < 0.33) {
        resolve({
          status: 'Heat',
          confidence: 87 + Math.round(Math.random() * 10),
          details: [
            'Swollen vulva detected (high confidence)',
            'Redness/discharge visible',
            'Restless posture observed',
            'Mounting behavior posture detected',
          ],
          recommendation: 'Immediate veterinary consultation recommended. Mark for artificial insemination window (12-18 hours).',
          processingTime: 1.2 + Math.random() * 0.8,
        });
      } else if (rand < 0.66) {
        resolve({
          status: 'Monitor',
          confidence: 72 + Math.round(Math.random() * 10),
          details: [
            'Mild restlessness detected',
            'Slight behavioral change observed',
            'Normal posture with occasional movement',
          ],
          recommendation: 'Continue monitoring for next 24-48 hours. Check again in 6 hours.',
          processingTime: 0.9 + Math.random() * 0.5,
        });
      } else {
        resolve({
          status: 'Healthy',
          confidence: 91 + Math.round(Math.random() * 8),
          details: [
            'Normal posture and behavior',
            'No signs of estrus detected',
            'Calm body language observed',
            'No visible physical indicators of heat',
          ],
          recommendation: 'No immediate action required. Continue routine monitoring schedule.',
          processingTime: 0.7 + Math.random() * 0.4,
        });
      }
    }, 2000 + Math.random() * 1000);
  });
}

const statusConfig: Record<CowStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode; gradient: string }> = {
  Heat: {
    label: 'Heat Detected',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: <AlertTriangle size={28} className="text-red-500" />,
    gradient: 'from-red-500 to-red-600',
  },
  Monitor: {
    label: 'Monitor Required',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: <Eye size={28} className="text-yellow-500" />,
    gradient: 'from-yellow-500 to-yellow-600',
  },
  Healthy: {
    label: 'Healthy / Normal',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: <CheckCircle size={28} className="text-green-500" />,
    gradient: 'from-green-500 to-green-600',
  },
};

export default function ImageAnalysis() {
  const cows = useCattleStore((s) => s.cows);
  const addAlert = useCattleStore((s) => s.addAlert);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedCow, setSelectedCow] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleImageUpload(file);
  };

  const handleAnalyze = async () => {
    if (!imageUrl) return;
    setAnalyzing(true);
    setResult(null);
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) { clearInterval(progressInterval); return 90; }
        return prev + Math.random() * 15;
      });
    }, 200);

    try {
      const analysisResult = await simulateAnalysis();
      clearInterval(progressInterval);
      setProgress(100);
      setResult(analysisResult);

      // If a cow is selected and status is not healthy, add alert
      if (selectedCow) {
        const cow = cows.find((c) => c.id === selectedCow);
        if (cow && analysisResult.status !== 'Healthy') {
          addAlert({
            cowId: cow.id,
            cowName: cow.name,
            tagId: cow.tagId,
            message: `Image analysis for ${cow.name} (Tag ${cow.tagId}): ${analysisResult.status === 'Heat' ? 'Heat detected with ' : 'Monitoring recommended with '}${analysisResult.confidence}% confidence.`,
            status: analysisResult.status,
            source: 'Image',
          });
        }
      }
    } catch {
      clearInterval(progressInterval);
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setImageUrl(null);
    setResult(null);
    setProgress(0);
    setSelectedCow('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Image Analysis</h1>
        <p className="text-slate-500 text-sm mt-1">Manual image upload for AI-powered heat detection</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Image size={18} className="text-purple-500" />
                Upload Image
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">Upload a cattle image for heat detection analysis</p>
            </div>
            <div className="p-5 space-y-4">
              {/* Cow Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Select Cow (Optional)</label>
                <select
                  value={selectedCow}
                  onChange={(e) => setSelectedCow(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Unknown / Not specified</option>
                  {cows.map((cow) => (
                    <option key={cow.id} value={cow.id}>
                      {cow.name} (#{cow.id} · {cow.tagId})
                    </option>
                  ))}
                </select>
              </div>

              {/* Upload Area */}
              {!imageUrl ? (
                <div
                  className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <Upload size={36} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">Drop image here or click to upload</p>
                  <p className="text-slate-400 text-sm mt-1">JPG, PNG, WEBP supported</p>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img
                      src={imageUrl}
                      alt="Uploaded cattle"
                      className="w-full h-64 object-cover"
                    />
                    {analyzing && (
                      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
                          <ScanLine size={32} className="text-green-400 mx-auto mb-2 animate-bounce" />
                          <p className="text-white font-medium text-sm">Analyzing image...</p>
                          <div className="mt-3 w-48 h-2 bg-white/20 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-400 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                          <p className="text-white/70 text-xs mt-1">{Math.round(progress)}%</p>
                        </div>
                      </div>
                    )}
                    {/* Scan line animation */}
                    {analyzing && (
                      <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute left-0 right-0 h-0.5 bg-green-400 opacity-60 animate-bounce"
                          style={{ top: '50%' }} />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={reset}
                      disabled={analyzing}
                      className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={14} />
                      Clear
                    </button>
                    <button
                      onClick={handleAnalyze}
                      disabled={analyzing}
                      className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      {analyzing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <ScanLine size={16} />
                          Analyze Image
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-purple-700 mb-2">How it works</h3>
            <ul className="space-y-1.5 text-xs text-purple-600">
              <li className="flex items-center gap-2">
                <span className="w-4 h-4 bg-purple-200 rounded-full flex items-center justify-center text-purple-700 font-bold flex-shrink-0">1</span>
                Upload a clear image of the cattle
              </li>
              <li className="flex items-center gap-2">
                <span className="w-4 h-4 bg-purple-200 rounded-full flex items-center justify-center text-purple-700 font-bold flex-shrink-0">2</span>
                Optionally select which cow it is
              </li>
              <li className="flex items-center gap-2">
                <span className="w-4 h-4 bg-purple-200 rounded-full flex items-center justify-center text-purple-700 font-bold flex-shrink-0">3</span>
                Click "Analyze Image" to run AI detection
              </li>
              <li className="flex items-center gap-2">
                <span className="w-4 h-4 bg-purple-200 rounded-full flex items-center justify-center text-purple-700 font-bold flex-shrink-0">4</span>
                View detailed result and recommendations
              </li>
            </ul>
          </div>
        </div>

        {/* Result Section */}
        <div>
          {!result ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm h-full flex items-center justify-center min-h-64">
              <div className="text-center p-8">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ScanLine size={32} className="text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">No analysis yet</p>
                <p className="text-slate-400 text-sm mt-1">Upload an image and click "Analyze Image" to see results</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Main Result Card */}
              <div className={`bg-white rounded-2xl border-2 ${statusConfig[result.status].border} shadow-sm overflow-hidden`}>
                <div className={`bg-gradient-to-r ${statusConfig[result.status].gradient} p-5`}>
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-xl">
                      {statusConfig[result.status].icon}
                    </div>
                    <div>
                      <p className="text-white/80 text-sm font-medium">Analysis Result</p>
                      <h2 className="text-white text-2xl font-bold">{statusConfig[result.status].label}</h2>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-white/80 text-xs">Confidence</p>
                      <p className="text-white text-2xl font-bold">{result.confidence}%</p>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Confidence Bar */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                      <span>Confidence Level</span>
                      <span>{result.confidence}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${statusConfig[result.status].gradient} transition-all duration-1000`}
                        style={{ width: `${result.confidence}%` }}
                      />
                    </div>
                  </div>

                  {/* Detection Details */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Detected Indicators</h3>
                    <ul className="space-y-1.5">
                      {result.details.map((d, i) => (
                        <li key={i} className={`flex items-start gap-2 text-sm ${statusConfig[result.status].color}`}>
                          <span className="mt-0.5 text-xs">✓</span>
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Recommendation */}
                  <div className={`${statusConfig[result.status].bg} rounded-xl p-4`}>
                    <h3 className="text-sm font-semibold text-slate-700 mb-1">Recommendation</h3>
                    <p className={`text-sm ${statusConfig[result.status].color}`}>{result.recommendation}</p>
                  </div>

                  {/* Processing Info */}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
                    <span>Processing time: {result.processingTime.toFixed(2)}s</span>
                    <span>AI Model: CattleVision v2.1</span>
                  </div>
                </div>
              </div>

              {/* If cow selected, show cow info */}
              {selectedCow && (() => {
                const cow = cows.find((c) => c.id === selectedCow);
                return cow ? (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Analyzed Animal</h3>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 font-bold">
                        {cow.name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{cow.name}</p>
                        <p className="text-xs text-slate-500">#{cow.id} · {cow.breed} · Tag: {cow.tagId}</p>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              <button
                onClick={reset}
                className="w-full border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} />
                Analyze Another Image
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
