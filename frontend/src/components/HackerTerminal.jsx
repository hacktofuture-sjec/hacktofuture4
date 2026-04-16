import { useState, useRef, useEffect } from 'react'
import { Terminal, ShieldAlert, Cpu, Activity, Server, Radio } from 'lucide-react'

export default function HackerTerminal() {
  const [logs, setLogs] = useState([
    'INITIATING SHADOW-NET PROTOCOL v4.2...',
    'ESTABLISHING SECURE KERNEL HOOK...',
    'CONNECTION SECURED. WAITING FOR OPERATOR INPUT.'
  ])
  const [input, setInput] = useState('')
  const [terminalState, setTerminalState] = useState('idle') // idle, scanning, dumping, exploiting, crashed
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Poll for dashboard defense signals
  useEffect(() => {
    if (terminalState !== 'exploiting') return
    const id = setInterval(async () => {
      try {
        const res = await fetch('/aegis-sync/state')
        const data = await res.json()
        if (data.defenseStatus === 'killed') {
          handleCrash()
        }
      } catch (e) {}
    }, 500)
    return () => clearInterval(id)
  }, [terminalState])

  const typeWriter = (text, delay = 30) => {
    return new Promise(resolve => {
      let i = 0
      setLogs(p => [...p, ''])
      const interval = setInterval(() => {
        setLogs(p => {
          const newLogs = [...p]
          newLogs[newLogs.length - 1] += text.charAt(i)
          return newLogs
        })
        i++
        if (i === text.length) {
          clearInterval(interval)
          resolve()
        }
      }, delay)
    })
  }

  const handleCrash = () => {
    setTerminalState('crashed')
    setLogs(p => [
      ...p, 
      '', 
      '====================================================',
      '!!! FATAL EXCEPTION OCCURRED IN MODULE 0x4B29A !!!',
      '====================================================',
      'CONNECTION SEVERED BY REMOTE HOST (OPA SIGKILL DISPATCHED).',
      'CONTAINER ISOLATION DETECTED.',
      'KERNEL HOOK DESTROYED.',
      'SYSTEM OFFLINE.'
    ])
  }

  const handleCommand = async (e) => {
    if (e.key !== 'Enter') return
    const cmd = input.trim()
    setInput('')
    
    setLogs(p => [...p, `root@shadow-net:~# ${cmd}`])

    if (cmd === 'help') {
      setLogs(p => [...p, 'Available exploits: scan, dump-memory, inject-payload'])
      return
    }

    if (cmd === 'scan') {
      setTerminalState('scanning')
      await typeWriter('SCANNING LOCAL SUBNET [■■■■■■■■■■] 100%')
      setLogs(p => [...p, 'FOUND VULNERABLE INSTANCE: SENTINEL-01 [10.0.4.22]'])
      setLogs(p => [...p, 'VULNERABILITY: STALE SESSION TOKEN IN MEMORY'])
      return
    }

    if (cmd === 'dump-memory') {
      setTerminalState('dumping')
      await typeWriter('BYPASSING FIDO2 MFA BOUNDARIES...')
      await typeWriter('EXTRACTING HEAP DUMP...')
      setLogs(p => [...p, '0x0000: 45 79 4a 68 62 47 63 69 4f 69 4a 53 55 7a 49 31 EyJhbGciOiJSUzI1'])
      setLogs(p => [...p, '0x0010: 4e 69 4a 39 2e 65 79 4a 70 64 48 4d 69 4f 69 4a NiJ9.eyJpdHMiOiJ'])
      setLogs(p => [...p, 'SESSION TOKEN EXTRACTED: Sarah_Admin (Composite_Principal)'])
      return
    }

    if (cmd === 'inject-payload') {
      setTerminalState('exploiting')
      await typeWriter('INJECTING STOLEN TOKEN...')
      await typeWriter('EXECUTING PAYLOAD: sys_openat("/forbidden_secrets.txt")')
      
      try {
        await fetch('/aegis-sync/attack', { method: 'POST' })
        setLogs(p => [...p, '[PAYLOAD DELIVERED. WAITING FOR DATA EXFILTRATION STREAM...]'])
        // If it's in Watch mode, it will just sit here dumping data successfully!
        setTimeout(() => {
          if (terminalState !== 'crashed') {
            setLogs(p => [...p, 'DATA BUFFER RECEIVING: 450MB/s...'])
          }
        }, 3000)
      } catch (err) {
        setLogs(p => [...p, 'ERROR SENDING EXPLOIT.'])
      }
      return
    }

    setLogs(p => [...p, `bash: ${cmd}: command not found`])
  }

  return (
    <div className={`min-h-screen bg-black font-mono p-4 sm:p-8 relative overflow-hidden transition-colors duration-500 ${terminalState === 'crashed' ? 'text-red-600' : 'text-emerald-500'}`}>
      <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] ${terminalState === 'crashed' ? 'from-red-900/20' : 'from-emerald-900/10'} via-black to-black pointer-events-none`} />
      
      {/* Grid Overlay for Cyberpunk feel */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,0,0.03)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none opacity-50" />

      <div className="max-w-6xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Panel: Terminal Environment */}
        <div className="lg:col-span-2 border border-emerald-900/50 bg-black/50 backdrop-blur-md rounded-xl p-6 shadow-[0_0_30px_rgba(16,185,129,0.05)]">
          <div className="flex items-center gap-3 mb-6 border-b border-emerald-900/50 pb-4">
            <Terminal className="w-6 h-6" />
            <div>
              <h1 className="text-lg font-bold tracking-widest">SHADOW-NET TERMINAL</h1>
              <p className="text-[10px] tracking-widest opacity-70">UNAUTHORIZED ACCESS PORTAL</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className={`text-[10px] uppercase font-bold animate-pulse ${terminalState === 'crashed' ? 'text-red-500' : 'text-emerald-500'}`}>
                {terminalState === 'crashed' ? '● SYSTEM FAILURE' : '● SECURE LINK'}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 mb-6 h-[500px] overflow-y-auto custom-scrollbar text-sm">
            {logs.map((log, i) => (
              <div key={i} className={`flex items-start gap-3 ${log.includes('FATAL') || log.includes('SEVERED') ? 'text-red-500 font-bold' : ''}`}>
                <span className="opacity-50">❯</span>
                <span className="flex-1 whitespace-pre-wrap">{log}</span>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="flex items-center gap-3 border-t border-emerald-900/30 pt-4">
            <span className="font-bold opacity-70">root@shadow-net:~#</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleCommand}
              disabled={terminalState === 'crashed'}
              className="flex-1 bg-transparent border-none outline-none text-emerald-400 placeholder-emerald-900/50"
              placeholder="Enter command... (help)"
              autoFocus
            />
          </div>
        </div>

        {/* Right Panel: Telemetry & Visualization */}
        <div className="space-y-6">
          
          <div className="border border-emerald-900/50 bg-black/50 backdrop-blur-md rounded-xl p-4">
            <h3 className="text-[10px] font-bold tracking-widest text-emerald-600/80 mb-4 flex items-center gap-2">
              <Activity className="w-3 h-3" /> ACTIVE THREADS
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="opacity-70">MEMORY DUMP</span>
                <span className={terminalState === 'dumping' || terminalState === 'exploiting' ? 'text-emerald-400' : 'opacity-40'}>
                  {terminalState === 'dumping' ? 'IN PROGRESS' : terminalState === 'exploiting' ? 'COMPLETE' : 'WAITING'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="opacity-70">PAYLOAD INJECTOR</span>
                <span className={terminalState === 'exploiting' ? 'text-emerald-400' : 'opacity-40'}>
                  {terminalState === 'exploiting' ? 'DEPLOYED' : 'STANDBY'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="opacity-70">DATA EXFIL</span>
                <span className={terminalState === 'exploiting' ? 'text-amber-400 animate-pulse' : 'opacity-40'}>
                  {terminalState === 'exploiting' ? 'RECEIVING' : 'STANDBY'}
                </span>
              </div>
            </div>
          </div>

          <div className="border border-emerald-900/50 bg-black/50 backdrop-blur-md rounded-xl p-4">
            <h3 className="text-[10px] font-bold tracking-widest text-emerald-600/80 mb-4 flex items-center gap-2">
              <Server className="w-3 h-3" /> TARGET INSTANCE
            </h3>
            <div className="relative h-32 border border-emerald-900/30 rounded bg-emerald-950/10 flex items-center justify-center overflow-hidden">
              {terminalState === 'crashed' ? (
                <div className="text-red-500 flex flex-col items-center animate-bounce">
                  <ShieldAlert className="w-8 h-8 mb-2" />
                  <span className="text-xs font-bold tracking-widest">ACCESS DENIED</span>
                </div>
              ) : terminalState === 'exploiting' ? (
                <div className="text-emerald-400 flex flex-col items-center">
                  <Radio className="w-8 h-8 mb-2 animate-ping" />
                  <span className="text-xs font-bold tracking-widest">HOOK ESTABLISHED</span>
                </div>
              ) : (
                <div className="text-emerald-900 flex flex-col items-center">
                  <Cpu className="w-8 h-8 mb-2" />
                  <span className="text-xs font-bold tracking-widest">NOT CONNECTED</span>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
