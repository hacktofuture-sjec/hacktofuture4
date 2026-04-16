import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Mic, Send, MessageSquare, Briefcase, Activity, CheckCircle2, ChevronRight, Hash } from 'lucide-react';
import axios from 'axios';

type ActionItem = {
  tool: string;
  action: string;
  details: any;
  status: string;
  message: string;
};

type FeedItem = {
  id: string;
  type: 'user' | 'agent';
  text: string;
  actions?: ActionItem[];
  timestamp: string;
};

export default function App() {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([
    {
      id: 'welcome',
      type: 'agent',
      text: "Hi, I'm your Autonomous PM. Tell me what's happening or what you need done, and I'll orchestrate Jira, Slack, and Linear automatically.",
      timestamp: new Date().toLocaleTimeString(),
    }
  ]);

  const endOfFeedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfFeedRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [feed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput('');
    setIsProcessing(true);

    const newId = Date.now().toString();
    setFeed(prev => [...prev, {
      id: `user-${newId}`,
      type: 'user',
      text: userMessage,
      timestamp: new Date().toLocaleTimeString()
    }]);

    try {
      // Connect to the new fastAPI endpoint
      const response = await axios.post('http://localhost:8001/pipeline/action', {
        text: userMessage,
        organization_id: "org-demo-123"
      });

      const { message, actions_taken } = response.data;

      setFeed(prev => [...prev, {
        id: `agent-${newId}`,
        type: 'agent',
        text: message,
        actions: actions_taken,
        timestamp: new Date().toLocaleTimeString()
      }]);

    } catch (error) {
      console.error(error);
      setFeed(prev => [...prev, {
        id: `error-${newId}`,
        type: 'agent',
        text: "I encountered an error trying to process that request.",
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E1117] text-gray-200 font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#161B22] p-4 flex items-center justify-between sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/20 p-2 rounded-lg border border-indigo-500/30">
            <Bot className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white leading-tight">VoxBridge Autonomous PM</h1>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></span>
              Systems Active
            </p>
          </div>
        </div>
        <div className="flex gap-2">
           <button className="px-3 py-1.5 text-sm bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition flex items-center gap-2 border border-gray-700">
             <Briefcase className="w-4 h-4"/> Org: HackToFuture
           </button>
        </div>
      </header>

      {/* Main Activity Feed */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6 pb-24">
          <AnimatePresence>
            {feed.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${item.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Agent Icon */}
                {item.type === 'agent' && (
                  <div className="w-10 h-10 rounded-full bg-[#161B22] border border-gray-700 flex items-center justify-center shrink-0 shadow-lg">
                    <Bot className="w-5 h-5 text-indigo-400" />
                  </div>
                )}

                {/* Bubble */}
                <div className={`flex flex-col gap-2 max-w-[85%] ${item.type === 'user' ? 'items-end' : 'items-start'}`}>
                  <div 
                    className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm sm:text-base leading-relaxed ${
                      item.type === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-sm' 
                        : 'bg-[#1C2128] border border-gray-700 text-gray-200 rounded-bl-sm'
                    }`}
                  >
                    {item.text}
                  </div>
                  
                  {/* Actions Area */}
                  {item.actions && item.actions.length > 0 && (
                    <div className="w-full flex justify-start pl-2">
                       <div className="bg-[#11141A] rounded-xl border border-gray-800 p-4 w-full md:w-4/5 shadow-inner">
                         <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 flex items-center gap-2">
                           <Activity className="w-3 h-3" /> Autonomous Actions
                         </h4>
                         <div className="space-y-3">
                           {item.actions.map((act, idx) => (
                             <motion.div 
                               initial={{ opacity: 0, x: -10 }}
                               animate={{ opacity: 1, x: 0 }}
                               transition={{ delay: idx * 0.2 }}
                               key={idx} 
                               className="flex items-start gap-3 bg-[#161B22] p-3 rounded-lg border border-gray-800"
                             >
                               <div className="mt-0.5">
                                 {act.status === 'success' ? (
                                   <CheckCircle2 className="w-4 h-4 text-green-400" />
                                 ) : (
                                   <ChevronRight className="w-4 h-4 text-gray-500" />
                                 )}
                               </div>
                               <div>
                                 <p className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                                   {act.tool === 'jira' && <Briefcase className="w-3.5 h-3.5 text-blue-400"/>}
                                   {act.tool === 'slack' && <Hash className="w-3.5 h-3.5 text-purple-400"/>}
                                   <span className="capitalize">{act.tool}</span> · <span className="font-mono text-xs opacity-75">{act.action}</span>
                                 </p>
                                 <p className="text-xs text-gray-500 mt-1">{act.message}</p>
                               </div>
                             </motion.div>
                           ))}
                         </div>
                       </div>
                    </div>
                  )}

                  <span className="text-[10px] text-gray-600 px-1 font-medium select-none">{item.timestamp}</span>
                </div>
              </motion.div>
            ))}
            
            {isProcessing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 justify-start">
                  <div className="w-10 h-10 rounded-full bg-[#161B22] border border-gray-700 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-indigo-400 animate-pulse" />
                  </div>
                  <div className="px-5 py-4 rounded-2xl bg-[#1C2128] border border-gray-700 rounded-bl-sm flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                    </div>
                    <span className="text-xs text-gray-500 ml-2 font-medium tracking-wide">Orchestrating...</span>
                  </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={endOfFeedRef} />
        </div>
      </main>

      {/* Input Bar */}
      <footer className="bg-[#161B22] border-t border-gray-800 p-4 sticky bottom-0 z-10">
        <div className="max-w-4xl mx-auto relative">
          <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
            
            <div className="relative flex-1 bg-[#0E1117] rounded-2xl border border-gray-700 hover:border-gray-600 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all shadow-inner overflow-hidden flex items-center">
              <span className="pl-4 text-gray-500">
                <MessageSquare className="w-5 h-5" />
              </span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Give me an update or command..."
                className="w-full bg-transparent text-gray-200 py-4 px-3 outline-none text-sm md:text-base placeholder:text-gray-600"
                disabled={isProcessing}
                autoComplete="off"
              />
              
              {/* Future Voice USP Button */}
              <button 
                type="button" 
                title="Voice input coming soon!"
                className="pr-4 pl-2 group"
              >
                <div className="p-2 rounded-xl group-hover:bg-gray-800 transition">
                   <Mic className="w-5 h-5 text-gray-500 group-hover:text-amber-400 group-hover:scale-110 transition-all duration-300" />
                </div>
              </button>
            </div>

            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="p-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] flex items-center justify-center shrink-0"
            >
              <Send className="w-5 h-5 ml-1 flex-shrink-0" />
            </button>
          </form>
          <div className="text-center mt-3">
             <p className="text-[11px] text-gray-500 font-medium">Text first. Seamless voice orchestration deploying soon.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
