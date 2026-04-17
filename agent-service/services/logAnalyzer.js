// agent-service/services/logAnalyzer.js

function analyzeLogs(rawLogs) {
    if (!rawLogs || rawLogs.length === 0) {
        return {
            summary: "No logs to analyze",
            top_patterns: [],
            root_cause_hint: "No log data available",
            severity: "low",
            noise_reduction: { original_logs: 0, compressed_insights: 0 }
        };
    }

    const patterns = {
        "DB Connection Errors": { keywords: ["db", "database", "connection"], count: 0 },
        "Timeout Issues": { keywords: ["timeout", "timed out", "slow"], count: 0 },
        "Retry Attempts": { keywords: ["retry", "retrying"], count: 0 },
        "Crash/Fatal Errors": { keywords: ["crash", "fatal", "exit", "killed"], count: 0 },
        "Memory/Overload": { keywords: ["memory", "oom", "overload", "tsunami", "capacity"], count: 0 },
        "Auth Failures": { keywords: ["auth", "unauthorized", "forbidden", "login"], count: 0 }
    };

    let unknownNoise = 0;

    // 1. Frequency Counting & Grouping
    rawLogs.forEach(log => {
        const lowerLog = log.toLowerCase();
        let matched = false;
        
        for (const [patternName, data] of Object.entries(patterns)) {
            if (data.keywords.some(kw => lowerLog.includes(kw))) {
                patterns[patternName].count++;
                matched = true;
                break; // Map to the first matched dominant pattern
            }
        }
        if (!matched) unknownNoise++;
    });

    // 2. Pattern Clustering
    const topPatterns = Object.entries(patterns)
        .filter(([_, data]) => data.count > 0)
        .map(([name, data]) => ({ pattern: name, count: data.count }))
        .sort((a, b) => b.count - a.count);

    // 3. Dominant Issue & Severity Estimation
    const dominant = topPatterns[0]?.pattern || "General Noise";
    let severity = "low";
    let rootCauseHint = "Standard operational noise";
    let summary = "System operating normally with standard log noise.";

    if (dominant === "Crash/Fatal Errors" || dominant === "Memory/Overload" || dominant === "DB Connection Errors") {
        severity = "high";
        rootCauseHint = `Critical resource exhaustion or core infrastructure failure (${dominant})`;
        summary = `${dominant} detected at high frequency. Immediate remediation required to prevent total outage.`;
    } else if (dominant === "Timeout Issues" || dominant === "Retry Attempts" || dominant === "Auth Failures") {
        severity = "medium";
        rootCauseHint = `Service instability due to ${dominant.toLowerCase()}`;
        summary = `Repeated ${dominant.toLowerCase()} detected, indicating degraded performance or connectivity loops.`;
    }

    // 4. Return Output Shape
    return {
        summary: summary,
        top_patterns: topPatterns.slice(0, 4), // Return top 4 patterns max
        root_cause_hint: rootCauseHint,
        severity: severity,
        noise_reduction: {
            original_logs: rawLogs.length,
            compressed_insights: topPatterns.length
        }
    };
}

module.exports = { analyzeLogs };