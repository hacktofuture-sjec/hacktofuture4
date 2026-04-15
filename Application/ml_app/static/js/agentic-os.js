document.addEventListener('DOMContentLoaded', () => {
    
    // UI Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const seqInput = document.getElementById('seq-input');
    const seqVal = document.getElementById('seq-val');
    const startScanBtn = document.getElementById('start-scan-btn');
    const resetBtn = document.getElementById('reset-btn');

    // States
    const stateUpload = document.getElementById('upload-state');
    const stateProcessing = document.getElementById('processing-state');
    const stateResult = document.getElementById('result-state');

    // Tabs
    const navItems = document.querySelectorAll('.nav-item');
    const tabViews = document.querySelectorAll('.tab-view');
    
    // Pipeline
    const pipeTracker = document.getElementById('pipeline-tracker');
    const pipeUpload = document.getElementById('step-upload');
    const pipeDetect = document.getElementById('step-detect');
    const pipeForensics = document.getElementById('step-forensics');
    const pipeVerify = document.getElementById('step-verify');
    const pipeDecision = document.getElementById('step-decision');

    let selectedFile = null;

    // --- TAB NAV LOGIC ---
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            tabViews.forEach(t => t.classList.remove('active', 'hidden'));
            tabViews.forEach(t => t.classList.add('hidden'));
            
            const target = document.getElementById(`view-${item.dataset.tab}`);
            if(target) target.classList.replace('hidden', 'active');
        });
    });

    // --- PIPELINE LOGIC ---
    function updatePipeline(step) {
        pipeTracker.classList.replace('hidden', 'active');
        [pipeUpload, pipeDetect, pipeForensics, pipeVerify, pipeDecision].forEach(p => p.classList.remove('active', 'completed'));
        
        if(step >= 1) pipeUpload.classList.add(step > 1 ? 'completed' : 'active');
        if(step >= 2) pipeDetect.classList.add(step > 2 ? 'completed' : 'active');
        if(step >= 3) pipeForensics.classList.add(step > 3 ? 'completed' : 'active');
        if(step >= 4) pipeVerify.classList.add(step > 4 ? 'completed' : 'active');
        if(step >= 5) pipeDecision.classList.add('active');
    }

    // --- 1. UPLOAD BAY LOGIC ---
    const sequenceOptions = [10, 20, 40, 60, 80, 100];
    let selectedSequence = sequenceOptions[0];

    seqInput.addEventListener('input', (e) => {
        selectedSequence = sequenceOptions[e.target.value];
        seqVal.textContent = selectedSequence;
    });

    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]);
    });
    dropZone.addEventListener('click', () => { fileInput.click(); });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFileSelect(e.target.files[0]);
    });

    function handleFileSelect(file) {
        selectedFile = file;
        const textArea = document.querySelector('.dz-text');
        
        let fileTypeTag = "Media";
        if(file.type.startsWith('audio/')) fileTypeTag = "Audio";
        else if(file.type.startsWith('video/')) fileTypeTag = "Video";
        else if(file.type.startsWith('image/')) fileTypeTag = "Image";

        textArea.innerHTML = `<span class="neon-cyan">${file.name}</span> Securely Locked`;
        document.querySelector('.dz-subtext').innerText = `Ready for ${fileTypeTag} Forensic Extraction`;
        document.getElementById('processing-media-type').innerText = `${fileTypeTag.toUpperCase()} CUBE`;

        startScanBtn.removeAttribute('disabled');
        startScanBtn.innerText = 'INITIATE AGENTIC SWARM';
        startScanBtn.style.boxShadow = '0 0 20px rgba(0,240,255,0.4)';
    }

    startScanBtn.addEventListener('click', initiateUpload);

    // --- 2. PROCESSING STATE (AGENTIC SWARM) ---
    async function initiateUpload() {
        if (!selectedFile) return;

        switchState(stateUpload, stateProcessing);
        updatePipeline(1);
        typeWriter('swarm-terminal-output', "Establishing secure uplink to core...");

        const isMockAudioOrImage = !selectedFile.type.startsWith('video/');

        try {
            if(!isMockAudioOrImage) {
                // Real Video Process
                const formData = new FormData();
                formData.append('upload_video_file', selectedFile);
                formData.append('sequence_length', selectedSequence);

                const upRes = await fetch('/api/upload/', { method: 'POST', body: formData, headers: {'X-CSRFToken': getCookie('csrftoken')} });
                const upData = await upRes.json();
                if (upData.error) throw new Error(upData.error);
                
                updatePipeline(2);
                typeWriter('swarm-terminal-output', "Upload Complete. Activating Isometric Swarm...");
                runAgentSwarm();

                const predRes = await fetch('/api/predict/', { method: 'POST', headers: {'X-CSRFToken': getCookie('csrftoken')} });
                const predData = await predRes.json();
                if (predData.error) throw new Error(predData.error);
                
                finishSwarm();
                updatePipeline(4);
                setTimeout(() => showResults(predData), 1000);
            } 
            else {
                // Mock Process for Audio/Image Design constraints
                updatePipeline(2);
                typeWriter('swarm-terminal-output', "Initializing Interface logic for Audio/Image Diagnostics...");
                runAgentSwarm();
                
                // Simulate 5 seconds processing
                await new Promise(r => setTimeout(r, 6000));
                
                finishSwarm();
                updatePipeline(4);

                // Mock Result Data
                const isAudio = selectedFile.type.startsWith('audio/');
                const isReal = Math.random() > 0.5;
                const conf = isReal ? (90 + Math.random()*9) : (85 + Math.random()*14);
                
                const mockOutput = {
                    output: isReal ? "REAL" : "FAKE",
                    confidence: conf.toFixed(1),
                    threat_data: Array.from({length: 40}, () => isReal ? Math.random() * 30 : Math.random() * 80 + 20),
                    explanation: isReal ? `Neural analysis verified ${isAudio ? "vocal tract constraints" : "noise consistency"} as biological origin.` : `Neural analysis detected ${isAudio ? "synthetic modulation and unnatural pitch variations" : "generative artifacts and frequency mismatches"} in the provided ${isAudio ? "audio waveform" : "image"}.`,
                    isAudioMock: isAudio,
                    isImageMock: !isAudio
                };
                
                setTimeout(() => showResults(mockOutput), 1000);
            }

        } catch (err) {
            typeWriter('swarm-terminal-output', `<span style="color:red">CRITICAL FAILURE: ${err.message}</span>`);
            setTimeout(() => {
                switchState(stateProcessing, stateUpload);
                startScanBtn.innerText = 'RETRY CONNECTION';
                pipeTracker.classList.replace('active', 'hidden');
            }, 3000);
        }
    }

    function runAgentSwarm() {
        const agents = document.querySelectorAll('.agent-node');
        const streams = document.querySelectorAll('.stream');
        const packets = document.querySelectorAll('.packet');
        
        agents.forEach((agent, i) => {
            setTimeout(() => {
                agent.classList.add('active');
                if(streams[i]) streams[i].classList.add('active');
                if(packets[i]) packets[i].classList.remove('hidden');
            }, i * 800);
        });

        const termMessages = [
            "Forensic Agent analyzing spatial constraints...",
            "Detection Agent running Neural Models...",
            "Metadata Agent verifying C2PA headers...",
            "Verification Agent checking origin hashes..."
        ];

        let idx = 0;
        const interval = setInterval(() => {
            if(idx < termMessages.length) {
                typeWriter('swarm-terminal-output', termMessages[idx]);
                if(idx === 2) updatePipeline(3); // Midway pipeline update
                idx++;
            } else {
                clearInterval(interval);
            }
        }, 1200);
        
        window.swarmInterval = interval;
    }

    function finishSwarm() {
        if(window.swarmInterval) clearInterval(window.swarmInterval);
        const agents = document.querySelectorAll('.agent-node');
        const streams = document.querySelectorAll('.stream');
        const packets = document.querySelectorAll('.packet');
        agents.forEach((agent, i) => {
            agent.classList.add('done');
            agent.classList.remove('active');
            if(packets[i]) packets[i].classList.add('hidden');
            if(streams[i]) streams[i].classList.remove('active');
        });
        typeWriter('swarm-terminal-output', "Consensus Reached. Aggregating output data...");
    }

    // --- 3. RESULTS STATE ---
    function showResults(data) {
        switchState(stateProcessing, stateResult);
        updatePipeline(5);

        const videoEl = document.getElementById('result-video');
        const audioEl = document.getElementById('result-audio');
        const heatmapEl = document.getElementById('heatmap-overlay');
        const scannerEl = document.querySelector('.holographic-scanner');
        
        const isAudio = data.isAudioMock;
        const isImg = data.isImageMock;
        const objUrl = URL.createObjectURL(selectedFile);

        // Toggle UI panels
        if(isAudio) {
            document.getElementById('video-viewer').classList.add('hidden');
            document.getElementById('audio-viewer').classList.remove('hidden');
            document.getElementById('media-viewer-header').innerHTML = '<span class="icon">🔊</span> Active Spectrogram Viewer';
            document.getElementById('graph-label').innerText = 'Audio Frequency Threat Graph';
            audioEl.src = objUrl;
            
            // Build animated mock spectrogram
            const waveBars = document.getElementById('waveform-bars');
            waveBars.innerHTML = '';
            for(let i=0; i<60; i++) {
                const b = document.createElement('div');
                b.className = 'wave-bar';
                if(data.output === 'FAKE' && i > 25 && i < 35) b.classList.add('alert');
                waveBars.appendChild(b);
            }
            // Animate it
            setInterval(() => {
                document.querySelectorAll('.wave-bar').forEach(b => {
                    b.style.height = (Math.random() * 80) + '%';
                });
            }, 100);

        } else if(isImg) {
            videoEl.src = "";
            videoEl.poster = objUrl;
            heatmapEl.style.display = 'none';
        } else {
            // Real video response handling
            videoEl.src = objUrl;
            
            if(data.heatmap_images && data.heatmap_images.length > 0) {
                let hmIdx = 0;
                heatmapEl.src = `/static/uploaded_images/${data.heatmap_images[0]}`;
                heatmapEl.style.display = 'block';
                
                setInterval(() => {
                    hmIdx = (hmIdx + 1) % data.heatmap_images.length;
                    heatmapEl.src = `/static/uploaded_images/${data.heatmap_images[hmIdx]}`;
                }, 500);
            }
        }

        // Biometric Dashboard
        const outputLabel = document.getElementById('final-output');
        const confText = document.getElementById('confidence-value');
        const liquid = document.getElementById('liquid-fill');
        const verdictBox = document.getElementById('final-verdict-box');
        
        outputLabel.innerText = data.output;
        let p = 0;
        const targetConf = parseFloat(data.confidence);
        const countUp = setInterval(() => {
            if(p >= targetConf) {
                clearInterval(countUp);
                confText.innerText = targetConf;
                liquid.style.height = `${targetConf}%`;
            } else {
                p += 2;
                if(p > targetConf) p = targetConf;
                confText.innerText = p.toFixed(1);
                liquid.style.height = `${p}%`;
            }
        }, 30);

        if(data.output === 'FAKE') {
            outputLabel.className = 'neon-text fake';
            liquid.className = 'liquid alert';
            verdictBox.style.borderColor = 'rgba(255,0,60,0.5)';
            document.getElementById('t-final-node').querySelector('.t-node').className = 't-node alert';
            document.getElementById('t-final-text').innerHTML = `<span style="color:var(--alert-crimson)">Synthetic Manipulation Detected</span>`;
        } else {
            outputLabel.className = 'neon-text real';
            liquid.className = 'liquid';
            verdictBox.style.borderColor = 'rgba(0,240,255,0.5)';
            document.getElementById('t-final-node').querySelector('.t-node').className = 't-node valid';
            document.getElementById('t-final-text').innerHTML = `<span style="color:var(--neon-cyan)">Cryptographically Validated</span>`;
        }

        // Threat Graph
        const threatContainer = document.getElementById('threat-bars');
        threatContainer.innerHTML = '';
        if(data.threat_data) {
            data.threat_data.forEach(t => {
                const bar = document.createElement('div');
                bar.className = 'bar' + (t > 50 ? ' high-threat' : '');
                bar.style.height = '2px';
                threatContainer.appendChild(bar);
                
                setTimeout(() => {
                    bar.style.height = `${t}%`;
                }, 500);
            });
        }

        // Explanation Typewriter
        document.getElementById('explanation-text').innerHTML = '';
        setTimeout(() => {
            typeWriter('explanation-text', data.explanation || `System consensus reached with ${targetConf}% certainty.`);
        }, 1500);
    }

    // Reset Flow
    resetBtn.addEventListener('click', () => {
        window.location.reload();
    });

    // Helper: Switch Section
    function switchState(hideSection, showSection) {
        hideSection.classList.remove('active-state');
        hideSection.classList.add('hidden-state');
        showSection.classList.remove('hidden-state');
        showSection.classList.add('active-state');
    }

    // Helper: Typewriter Effect
    function typeWriter(elementId, text) {
        const el = document.getElementById(elementId);
        el.innerHTML = '';
        let i = 0;
        const speed = 20;
        function type() {
            if (i < text.length) {
                if(text.startsWith('<')) { el.innerHTML = text; return; }
                el.innerHTML += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        }
        type();
    }

    // Django CSRF Helper
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
});
