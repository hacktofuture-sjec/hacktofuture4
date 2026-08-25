const axios = require('axios');
require('dotenv').config();

/**
 * 🧠 Intelligent Groq Civic AI Classifier & Severity Analyzer
 */
const analyzeWithGroq = async (text) => {
  try {
    const prompt = `You are a Smart City Municipal Governance AI triaging citizen complaints.
Analyze the following civic complaint and accurately determine its category, severity level, and key risk indicators.

Categories:
- Road: Potholes, broken asphalt, damaged footpaths, sinkholes, road cave-in, traffic signal faults, bridge damage, debris blocking roads.
- Water: Pipeline bursts, severe leaks, water contamination, low pressure, water supply shortage, sewage overflow, drainage flooding.
- Electricity: Exposed/hanging live wires, sparking transformers, street light outages, power grid failures, damaged electric poles, blackout.
- Garbage: Waste accumulation, overflowing municipal bins, illegal toxic dumping, animal carcass, littering around public areas.
- Safety: Open/uncovered manholes, structural building cracks, fire hazards, public harassment, theft, dangerous open excavations.
- Other: General municipal inquiries and miscellaneous civic items.

Severity Guidelines:
- High: Immediate threat to life, public safety, physical injury, electrocution risk, open manholes, major pipe bursts flooding roads, deep dangerous potholes causing accidents, sparking wires, hospital area blocks.
- Medium: Significant public inconvenience, standard potholes, neighborhood streetlight outages, overflowing trash bins, moderate water leaks, clogged drain.
- Low: Cosmetic issues, routine maintenance, faded lane markings, requested speed bumps, park bench repairs, non-hazardous overgrown grass.

Return ONLY a valid JSON object with the following structure:
{
  "category": "Road" | "Water" | "Electricity" | "Garbage" | "Safety" | "Other",
  "severity": "High" | "Medium" | "Low",
  "reason": "Brief 1-sentence rationale for chosen severity",
  "keywords": ["keyword1", "keyword2"]
}

Complaint: "${text}"`;

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000
      }
    );

    const result = JSON.parse(response.data.choices[0].message.content);
    console.log(`🤖 Groq AI Triage: [${result.category}] Severity: [${result.severity}] -> "${text}"`);
    return result;
  } catch (error) {
    console.error('⚠️ Groq API Error - Running Enhanced Local Heuristic Brain:', error.message);
    
    // High-accuracy fallback heuristic rules
    const low = text.toLowerCase();
    let category = 'Other';
    let severity = 'Medium';

    if (/water|leak|pipe|flood|sewage|drain|contamination|tap/i.test(low)) category = 'Water';
    else if (/garbage|trash|waste|dump|litter|cleaning|sanitation|carcass/i.test(low)) category = 'Garbage';
    else if (/electric|wire|light|power|pole|spark|transformer|current|shock/i.test(low)) category = 'Electricity';
    else if (/road|pothole|pavement|bridge|asphalt|traffic|culvert|divider/i.test(low)) category = 'Road';
    else if (/manhole|safe|theft|danger|harass|police|security|hazard|crack/i.test(low)) category = 'Safety';

    // Critical safety triggers
    const highRiskTriggers = [
      'live wire', 'spark', 'shock', 'electrocution', 'open manhole', 'manhole',
      'deep pothole', 'accident', 'injury', 'danger', 'hazard', 'emergency',
      'burst', 'flooding', 'flooded', 'toxic', 'collapsed', 'cave in', 'hospital'
    ];

    const isHigh = highRiskTriggers.some(trigger => low.includes(trigger));
    if (isHigh) {
      severity = 'High';
    } else if (/faded|bench|paint|grass|request|minor|cosmetic/i.test(low)) {
      severity = 'Low';
    }

    return { category, severity, keywords: [] };
  }
};

module.exports = { analyzeWithGroq };
