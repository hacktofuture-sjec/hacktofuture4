const express = require('express');
const cors = require('cors');
const path = require('path');
const k8s = require('@kubernetes/client-node');
const { exec } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let k8sApi = null;
let useK8s = false;

// Try loading Kube config
try {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    k8sApi = kc.makeApiClient(k8s.AppsV1Api);
    // Simple test to see if we can connect
    k8sApi.listNamespacedDeployment('default').then(() => {
        console.log("Connected to Real Kubernetes Cluster!");
        useK8s = true;
    }).catch((err) => {
        console.log("No live Kubernetes cluster found. Falling back to Simulation Engine.");
    });
} catch (e) {
    console.log("No local Kubeconfig. Operating in Simulation Engine mode.");
}

// SIMULATION STATE
let currentPhase = 'NORMAL';
let phaseTime = 0;
let baseCount = 2;
let podNames = ['Pod-A01', 'Pod-B02'];
let logsBuffer = [];

function addLog(msg, type) {
    const time = new Date().toISOString().split('T')[1].substring(0,8);
    logsBuffer.push({ time, msg, type });
    if(logsBuffer.length > 20) logsBuffer.shift();
    console.log(`[${type.toUpperCase()}] ${msg}`);
}

addLog('System instantiated. Connection to metrics server established.', 'info');
addLog('Neural net baseline calculated.', 'ai');

// SIMULATION ENGINE TICKER
let currentCpu = 25;
let currentReqs = 142;
let cpuStatus = { class: 'status-healthy', text: 'NOMINAL', color: '#00e5ff' };
let globalStatus = { class: 'status-healthy', text: 'DOMAINS SECURE', color: '#00ff66' };

setInterval(() => {
    phaseTime++;
    if (!useK8s) {
        // Run Simulated Load Engine
        let reqs = Math.floor(Math.random() * 50) + 120;
        
        if (currentPhase === 'NORMAL' || currentPhase === 'STABILIZED') {
            currentCpu = Math.floor(Math.random() * 15) + 20;
            currentReqs = reqs;
            if(phaseTime % 4 === 0 && Math.random() > 0.5) addLog(`Metrics synced. CPU: ${currentCpu}%, REQ: ${reqs}/s`, 'info');
        } 
        else if (currentPhase === 'SPIKE') {
            currentReqs = Math.floor(Math.random() * 100) + 250;
            currentCpu = Math.min(85, 30 + (phaseTime * 10));
        }
        else if (currentPhase === 'CRITICAL') {
            currentReqs = Math.floor(Math.random() * 150) + 300;
            currentCpu = Math.min(99, 85 + Math.floor(Math.random() * 10));
        }
        else if (currentPhase === 'HEALING') {
            currentReqs = Math.floor(Math.random() * 80) + 180;
            currentCpu = Math.max(35, 95 - (phaseTime * 7));
            
            if (currentCpu < 75 && currentCpu >= 55) { cpuStatus.color = '#ffb700'; }
            else if (currentCpu < 55) { cpuStatus.color = '#00e5ff'; }
            
            if(phaseTime === 7) {
                setPhase('STABILIZED');
            }
        }
    }
}, 1200);

function executeKubectl(cmd) {
    if(useK8s) {
        exec(`kubectl ${cmd}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`kubectl error: ${error.message}`);
                return;
            }
            if (stderr) console.error(`kubectl stderr: ${stderr}`);
        });
    }
}

function setPhase(phase) {
    currentPhase = phase;
    phaseTime = 0;
    
    if(phase === 'NORMAL') {
        cpuStatus = { class: 'status-healthy', text: 'NOMINAL', color: '#00e5ff' };
        globalStatus = { class: 'status-healthy', text: 'DOMAINS SECURE', color: '#00ff66' };
        baseCount = 2;
        podNames = ['Pod-A01', 'Pod-B02'];
        addLog('Manual Override: System returned to NORMAL state.', 'info');
        
        // Execute real K8s scale down
        executeKubectl('scale deployment self-healing-app --replicas=2');
    }
    else if(phase === 'SPIKE') {
        addLog(`Manual Override: Traffic spike simulation initiated.`, 'warn');
        addLog(`Forecasting 95% CPU breach within 4.2s`, 'ai');
        cpuStatus = { class: 'status-warn', text: 'SPIKE PREDICTED', color: '#ffb700' };
    }
    else if(phase === 'CRITICAL') {
        addLog(`Manual Override: Force failing Node-1. Threshold breached!`, 'err');
        cpuStatus = { class: 'status-danger', text: 'CRITICAL LOAD', color: '#ff0055' };
        globalStatus = { class: 'status-danger', text: 'SYSTEM STRESS', color: '#ff0055' };
        baseCount = 1;
        podNames = [podNames[1] || 'Pod-B02'];
        
        // Execute real K8s pod deletion to force a crash
        executeKubectl('delete po -l app=self-healing-app --force --grace-period=0');
    }
    else if(phase === 'HEALING') {
        addLog(`Manual Override: Injecting HPA override. Dispatching replica sets.`, 'succ');
        globalStatus = { class: 'status-action', text: 'HEALING IN PROGRESS', color: '#00e5ff' };
        podNames = [podNames[0], 'Pod-S01', 'Pod-S02', 'Pod-S03'];
        baseCount = 4;
        
        // Execute real K8s scale up
        executeKubectl('scale deployment self-healing-app --replicas=4');
    }
    else if(phase === 'STABILIZED') {
        addLog(`Pods ready. Traffic load balancing restored.`, 'succ');
        cpuStatus = { class: 'status-healthy', text: 'STABILIZED', color: '#00e5ff' };
    }
}

// Routes
app.get('/api/status', (req, res) => {
    res.json({
        cpu: currentCpu,
        reqs: currentReqs,
        cpuStatus,
        globalStatus,
        pods: { count: baseCount, names: podNames },
        logs: logsBuffer,
        phase: currentPhase
    });
});

app.post('/api/action', (req, res) => {
    const { action } = req.body;
    if (['NORMAL', 'SPIKE', 'CRITICAL', 'HEALING'].includes(action)) {
        setPhase(action);
        res.json({ success: true, phase: currentPhase });
    } else {
        res.status(400).json({ error: 'Invalid action' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Neural Net Agent Controller running on http://localhost:${PORT}`);
});
