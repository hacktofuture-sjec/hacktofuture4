import { useState, useRef, useEffect } from 'react'
import { Terminal } from 'lucide-react'

export default function HackerTerminal() {
  const [logs, setLogs] = useState([
    'INITIATING SHADOW-NET PROTOCOL v4.2...',
    'ESTABLISHING SECURE KERNEL HOOK...',
    'CONNECTION SECURED. WAITING FOR OPERATOR INPUT.'
  ])
  const [input, setInput] = useState('')
  const [isAttacking, setIsAttacking] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

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

  const handleCommand = async (e) => {
    if (e.key !== 'Enter') return
    const cmd = input.trim()
    setInput('')
    
    setLogs(p => [...p, `root@shadow-net:~# ${cmd}`])

    if (cmd === 'help') {
      setLogs(p => [...p, 'Available commands: help, scan, steal-token, exploit'])
      return
    }

    if (cmd === 'scan') {
      await typeWriter('SCANNING LOCAL SUBNET...')
      setLogs(p => [...p, 'FOUND VULNERABLE INSTANCE: SENTINEL-01 [10.0.4.22]'])
      return
    }

    if (cmd.startsWith('steal-token') || cmd === 'steal') {
      await typeWriter('BYPASSING FIDO2 MFA BOUNDARIES...')
      await typeWriter('[OK] MEMORY DUMP SUCCESSFUL.')
      setLogs(p => [...p, 'SESSION TOKEN EXTRACTED: eyJhbGciOiJSUzI1... (Sarah_Admin)'])
      setLogs(p => [...p, 'READY FOR INJECTION.'])
      return
    }

    if (cmd === 'exploit') {
      setIsAttacking(true)
      await typeWriter('INJECTING STOLEN TOKEN...')
      await typeWriter('EXECUTING PAYLOAD: sys_openat("/forbidden_secrets.txt")')
      
      try {
        await fetch('/aegis-sync/attack', { method: 'POST' })
        setLogs(p => [...p, '[PAYLOAD DELIVERED. WAITING FOR KERNEL RESPONSE...]'])
        
        // Simulate waiting for OPA to kill it
        setTimeout(() => {
          setLogs(p => [...p, '', '!!! FATAL ERROR !!!', 'CONNECTION SEVERED BY REMOTE HOST.'])
          setLogs(p => [...p, 'REASON: SIGKILL DISPATCHED BY OPA POLICY ENGINE.'])
          setIsAttacking(false)
        }, 5000)
      } catch (err) {
        setLogs(p => [...p, 'ERROR SENDING EXPLOIT TO LOCALHOST.'])
      }
      return
    }

    setLogs(p => [...p, `bash: ${cmd}: command not found`])
  }

  return (
    <div className="min-h-screen bg-black text-rose-500 font-mono p-4 sm:p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-900/10 via-black to-black pointer-events-none" />
      
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex items-center gap-3 mb-8 border-b border-rose-900/50 pb-4">
          <Terminal className="w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold tracking-widest text-rose-500">ATTACK VECTOR TERMINAL</h1>
            <p className="text-xs text-rose-800 tracking-widest">UNAUTHORIZED ACCESS PORTAL</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-rose-700 animate-pulse">● LIVE CONNECTION</span>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          {logs.map((log, i) => (
            <div key={i} className={`flex items-start gap-2 ${log.includes('FATAL') ? 'text-red-500 font-black text-lg mt-4' : ''}`}>
              <span className="text-rose-900">{'>'}</span>
              <span className="flex-1 whitespace-pre-wrap">{log}</span>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="flex items-center gap-2 border-t border-rose-900/30 pt-4">
          <span className="text-rose-500 font-bold">root@shadow-net:~#</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleCommand}
            disabled={isAttacking}
            className="flex-1 bg-transparent border-none outline-none text-rose-400 placeholder-rose-900"
            placeholder="Type 'help' to start..."
            autoFocus
          />
        </div>
      </div>
    </div>
  )
}
