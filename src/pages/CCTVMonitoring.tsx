import { useState, useEffect, useRef, useCallback } from 'react';
import { useCattleStore } from '../store/cattleStore';
import {
  Camera, AlertTriangle, Tag, Zap, Activity,
  Upload, Play, Monitor, ChevronRight, Eye
} from 'lucide-react';

type VideoSource = 'simulation' | 'upload' | 'youtube';

const DETECTION_POOL = [
  { tagId: 'KA-1023', event: 'Tag detected', confidence: 97 },
  { tagId: 'KA-1025', event: 'Mounting behavior detected', confidence: 92 },
  { tagId: 'KA-1024', event: 'Increased movement detected', confidence: 88 },
  { tagId: 'KA-1026', event: 'Restlessness observed', confidence: 85 },
  { tagId: 'KA-1023', event: 'Mounting behavior detected', confidence: 95 },
  { tagId: 'KA-1025', event: 'Increased vocalization', confidence: 78 },
  { tagId: 'KA-1027', event: 'Tag detected', confidence: 99 },
  { tagId: 'KA-1028', event: 'Restlessness observed', confidence: 82 },
  { tagId: 'KA-1024', event: 'Mounting behavior detected', confidence: 90 },
];

function getYouTubeEmbedUrl(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ];
  for (const pat of patterns) {
    const m = url.match(pat);
    if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1`;
  }
  return null;
}

function determineStatus(event: string): 'Heat' | 'Monitor' | 'Healthy' {
  if (event.includes('Mounting')) return 'Heat';
  if (event.includes('movement') || event.includes('Restlessness') || event.includes('vocalization')) return 'Monitor';
  return 'Healthy';
}

interface LogEntry {
  id: string;
  text: string;
  tag: string;
  time: string;
  type: 'heat' | 'monitor' | 'normal';
}

export default function CCTVMonitoring() {
  const cows = useCattleStore((s) => s.cows);
  const addAlert = useCattleStore((s) => s.addAlert);
  const addDetectionEvent = useCattleStore((s) => s.addDetectionEvent);
  const detectionEvents = useCattleStore((s) => s.detectionEvents);

  const [videoSource, setVideoSource] = useState<VideoSource>('simulation');
  const [isLive, setIsLive] = useState(true);
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const [youtubeEmbed, setYoutubeEmbed] = useState<string | null>(null);
  const [youtubeInput, setYoutubeInput] = useState('');
  const [detectionLog, setDetectionLog] = useState<LogEntry[]>([]);
  const [scanLine, setScanLine] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionBox, setDetectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const detectionTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const triggerDetection = useCallback(() => {
    const pool = DETECTION_POOL[Math.floor(Math.random() * DETECTION_POOL.length)];
    const cow = cows.find((c) => c.tagId === pool.tagId);

    setIsDetecting(true);
    setDetectionBox({
      x: 10 + Math.random() * 40,
      y: 10 + Math.random() * 40,
      w: 20 + Math.random() * 20,
      h: 20 + Math.random() * 20,
    });
    setTimeout(() => setIsDetecting(false), 2000);

    addDetectionEvent({ tagId: pool.tagId, event: pool.event, confidence: pool.confidence });

    const logType: 'heat' | 'monitor' | 'normal' = pool.event.includes('Mounting')
      ? 'heat'
      : pool.event.includes('movement') || pool.event.includes('Restlessness')
      ? 'monitor'
      : 'normal';

    const logEntry: LogEntry = {
      id: `log-${Date.now()}`,
      text: cow
        ? `${pool.event} — ${cow.name} (${pool.tagId})`
        : `${pool.event} — Tag ${pool.tagId}`,
      tag: pool.tagId,
      time: new Date().toLocaleTimeString('en-IN'),
      type: logType,
    };

    setDetectionLog((prev) => [logEntry, ...prev].slice(0, 20));

    if (cow) {
      const status = determineStatus(pool.event);
      if (status !== 'Healthy') {
        addAlert({
          cowId: cow.id,
          cowName: cow.name,
          tagId: pool.tagId,
          message: `Cow ${cow.name} (Tag ${pool.tagId}) ${pool.event.toLowerCase()} — ${status === 'Heat' ? 'likely in estrus phase. Immediate vet attention required.' : 'monitor closely.'}`,
          status,
          source: 'CCTV',
        });
      }
    }
  }, [cows, addAlert, addDetectionEvent]);

  const startDetection = useCallback(() => {
    if (detectionTimer.current) clearInterval(detectionTimer.current);
    setTimeout(triggerDetection, 2000);
    detectionTimer.current = setInterval(triggerDetection, 7000 + Math.random() * 3000);
  }, [triggerDetection]);

  const stopDetection = useCallback(() => {
    if (detectionTimer.current) {
      clearInterval(detectionTimer.current);
      detectionTimer.current = null;
    }
  }, []);

  useEffect(() => {
    scanTimer.current = setInterval(() => {
      setScanLine((prev) => (prev >= 100 ? 0 : prev + 0.5));
    }, 16);
    return () => { if (scanTimer.current) clearInterval(scanTimer.current); };
  }, []);

  useEffect(() => {
    const shouldDetect =
      (videoSource === 'simulation' && isLive) ||
      (videoSource === 'upload' && uploadedVideo !== null) ||
      (videoSource === 'youtube' && youtubeEmbed !== null);

    if (shouldDetect) {
      startDetection();
    } else {
      stopDetection();
    }
    return stopDetection;
  }, [videoSource, isLive, uploadedVideo, youtubeEmbed, startDetection, stopDetection]);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadedVideo(url);
    }
  };

  const handleYoutubeLoad = () => {
    const embed = getYouTubeEmbedUrl(youtubeInput);
    if (embed) {
      setYoutubeEmbed(embed);
    }
  };

  const sourceTabs = [
    { id: 'simulation' as VideoSource, label: 'Live Simulation', icon: Monitor },
    { id: 'upload' as VideoSource, label: 'Upload Video', icon: Upload },
    { id: 'youtube' as VideoSource, label: 'YouTube Link', icon: Play },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">CCTV Monitoring</h1>
          <p className="text-slate-500 text-sm mt-1">Automated 24/7 AI-powered livestock surveillance</p>
        </div>
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-red-600 text-xs font-semibold">LIVE DETECTION</span>
        </div>
      </div>

      {/* Video Source Tabs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex border-b border-slate-100">
          {sourceTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setVideoSource(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors flex-1 justify-center ${
                  videoSource === tab.id
                    ? 'text-green-600 border-b-2 border-green-500 bg-green-50'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {/* SIMULATION */}
          {videoSource === 'simulation' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">Simulated 24/7 CCTV feed with AI detection overlay</p>
                <button
                  onClick={() => setIsLive(!isLive)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isLive ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
                >
                  {isLive ? 'Pause Detection' : 'Resume Detection'}
                </button>
              </div>

              <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-video">
                <div className="absolute inset-0 opacity-5"
                  style={{ backgroundImage: 'repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 40px)' }} />

                <div className="absolute inset-0 flex items-end justify-center pb-8 opacity-20">
                  <div className="flex gap-8">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex flex-col items-center">
                        <div className="w-12 h-20 bg-amber-600" />
                        <div className="w-16 h-3 bg-amber-800" />
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="absolute left-0 right-0 h-0.5 bg-green-400 opacity-40 blur-sm"
                  style={{ top: `${scanLine}%` }}
                />

                {isDetecting && detectionBox && (
                  <div
                    className="absolute border-2 border-yellow-400 rounded animate-pulse"
                    style={{
                      left: `${detectionBox.x}%`,
                      top: `${detectionBox.y}%`,
                      width: `${detectionBox.w}%`,
                      height: `${detectionBox.h}%`,
                    }}
                  >
                    <div className="absolute -top-5 left-0 bg-yellow-400 text-black text-xs px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
                      {detectionLog[0]?.tag ?? 'Detecting...'}
                    </div>
                    <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-green-400" />
                    <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-green-400" />
                    <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-green-400" />
                    <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-green-400" />
                  </div>
                )}

                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-green-400 text-xs font-mono">CAM-01 LIVE</span>
                </div>
                <div className="absolute top-3 right-3 text-green-400 text-xs font-mono">
                  {new Date().toLocaleTimeString('en-IN')}
                </div>
                <div className="absolute bottom-3 left-3 text-green-400 text-xs font-mono">
                  AI DETECTION: {isLive ? 'ACTIVE' : 'PAUSED'} | FPS: 24
                </div>
                <div className="absolute bottom-3 right-3 text-green-400 text-xs font-mono">
                  BARN-SECTOR-A
                </div>

                <div className="absolute inset-0 flex items-center justify-around px-8">
                  {['🐄', '🐄', '🐄'].map((emoji, i) => (
                    <div
                      key={i}
                      className={`text-5xl opacity-30 ${i === 1 ? 'animate-bounce' : ''}`}
                      style={{ animationDuration: '2s', animationDelay: `${i * 0.5}s` }}
                    >
                      {emoji}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* UPLOAD */}
          {videoSource === 'upload' && (
            <div className="space-y-4">
              {!uploadedVideo ? (
                <div
                  className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors"
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
                  <Upload size={40} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">Drop video here or click to upload</p>
                  <p className="text-slate-400 text-sm mt-1">MP4, MOV, AVI — Detection starts automatically</p>
                  <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                </div>
              ) : (
                <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                  <video src={uploadedVideo} controls autoPlay muted className="w-full h-full object-contain" />

                  {isDetecting && detectionBox && (
                    <div
                      className="absolute border-2 border-yellow-400 rounded animate-pulse pointer-events-none"
                      style={{
                        left: `${detectionBox.x}%`,
                        top: `${detectionBox.y}%`,
                        width: `${detectionBox.w}%`,
                        height: `${detectionBox.h}%`,
                      }}
                    >
                      <div className="absolute -top-5 left-0 bg-yellow-400 text-black text-xs px-1.5 py-0.5 rounded font-mono">
                        {detectionLog[0]?.tag ?? 'Detecting...'}
                      </div>
                    </div>
                  )}

                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-green-400 text-xs font-mono bg-black/50 px-2 py-0.5 rounded">AI DETECTING</span>
                  </div>

                  <button
                    onClick={() => setUploadedVideo(null)}
                    className="absolute top-3 right-3 bg-red-600 text-white text-xs px-2 py-1 rounded hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

          {/* YOUTUBE */}
          {videoSource === 'youtube' && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500 font-bold text-xs">▶</span>
                  <input
                    type="text"
                    placeholder="Paste YouTube URL (e.g. https://youtu.be/abc123)"
                    value={youtubeInput}
                    onChange={(e) => setYoutubeInput(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <button
                  onClick={handleYoutubeLoad}
                  className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Play size={14} />
                  Load & Detect
                </button>
              </div>

              {!youtubeEmbed ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
                  <div className="text-5xl mb-3">📺</div>
                  <p className="text-slate-500 text-sm">Enter a YouTube URL above to start monitoring</p>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden aspect-video bg-black">
                  <iframe
                    src={youtubeEmbed}
                    className="w-full h-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                  {isDetecting && detectionBox && (
                    <div
                      className="absolute border-2 border-yellow-400 rounded animate-pulse pointer-events-none"
                      style={{
                        left: `${detectionBox.x}%`,
                        top: `${detectionBox.y}%`,
                        width: `${detectionBox.w}%`,
                        height: `${detectionBox.h}%`,
                      }}
                    >
                      <div className="absolute -top-5 left-0 bg-yellow-400 text-black text-xs px-1.5 py-0.5 rounded font-mono">
                        {detectionLog[0]?.tag ?? 'Detecting...'}
                      </div>
                    </div>
                  )}
                  <div className="absolute top-3 left-3 pointer-events-none">
                    <div className="flex items-center gap-2 bg-black/70 px-3 py-1.5 rounded-full">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-green-400 text-xs font-mono">AI DETECTING</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setYoutubeEmbed(null); setYoutubeInput(''); }}
                    className="absolute top-3 right-3 bg-red-600 text-white text-xs px-2 py-1 rounded hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detection Log + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Activity size={18} className="text-green-500" />
                Detection Log
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Real-time AI detection events</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Zap size={12} className="text-yellow-500" />
              Auto-updating
            </div>
          </div>
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            {detectionLog.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Camera size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Waiting for detection events...</p>
                <p className="text-xs mt-1">Events appear automatically</p>
              </div>
            ) : (
              detectionLog.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${
                    log.type === 'heat'
                      ? 'bg-red-50 border-red-100'
                      : log.type === 'monitor'
                      ? 'bg-yellow-50 border-yellow-100'
                      : 'bg-green-50 border-green-100'
                  }`}
                >
                  <div className={`flex-shrink-0 mt-0.5 ${log.type === 'heat' ? 'text-red-500' : log.type === 'monitor' ? 'text-yellow-500' : 'text-green-500'}`}>
                    {log.type === 'heat' ? <AlertTriangle size={14} /> : log.type === 'monitor' ? <Eye size={14} /> : <Tag size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${log.type === 'heat' ? 'text-red-700' : log.type === 'monitor' ? 'text-yellow-700' : 'text-green-700'}`}>
                      {log.text}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{log.time}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Tag size={18} className="text-blue-500" />
              Tag Registry
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Tag → Cow mapping</p>
          </div>
          <div className="p-4 space-y-2">
            {cows.map((cow) => (
              <div key={cow.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="font-mono text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">{cow.tagId}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{cow.name}</p>
                  <p className="text-xs text-slate-400">#{cow.id} · {cow.breed}</p>
                </div>
                <ChevronRight size={14} className="text-slate-300" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: detectionEvents.length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Heat Alerts', value: detectionEvents.filter(e => e.event.includes('Mounting')).length, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Movement', value: detectionEvents.filter(e => e.event.includes('movement')).length, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Tags Scanned', value: new Set(detectionEvents.map(e => e.tagId)).size, color: 'text-green-600', bg: 'bg-green-50' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} rounded-2xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-slate-600 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
