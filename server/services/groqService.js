const axios = require('axios');
require('dotenv').config();

const analyzeWithGroq = async (text) => {
  try {
    const prompt = `You are a city administration AI. Categorize this civic complaint into exactly one category and one severity level.
    Return strictly valid JSON with these keys: "category", "severity".

    Categories:
    - Garbage: Trash collection, sanitation, waste disposal, cleaning.
    - Water: Leaks, pipe bursts, supply shortages, drainage issues, sewage.
    - Electricity: Street lights, power outages, sparking wires, transformer issues.
    - Road: Potholes, broken pavement, illegal parking, traffic signals.
    - Safety: Security concerns, theft, harassment, emergency situations.
    - Other: Anything that doesn't fit the above.

    Severities:
    - Low: Minor inconvenience, non-urgent.
    - Medium: Disruptive but not immediately dangerous.
    - High: Emergency, hazard, danger, accidents, or life-safety risk.

    Complaint: "${text}"`;

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const result = JSON.parse(response.data.choices[0].message.content);
    return result;
  } catch (error) {
    console.error('Groq API Error - Activating Local Backup Brain:', error.message);
    
    // Local Backup Hero: If AI fails, use keyword heuristics
    const lowText = text.toLowerCase();
    let category = 'Other';
    let severity = 'Medium';

    if (lowText.includes('water') || lowText.includes('leak') || lowText.includes('pipe')) category = 'Water';
    else if (lowText.includes('garbage') || lowText.includes('trash') || lowText.includes('waste')) category = 'Garbage';
    else if (lowText.includes('light') || lowText.includes('electric') || lowText.includes('power')) category = 'Electricity';
    else if (lowText.includes('road') || lowText.includes('pothole')) category = 'Road';
    else if (lowText.includes('safe') || lowText.includes('theft') || lowText.includes('police')) category = 'Safety';

    if (lowText.includes('massive') || 
        lowText.includes('emergency') || 
        lowText.includes('hazard') || 
        lowText.includes('danger') || 
        lowText.includes('accident') || 
        lowText.includes('injury') ||
        lowText.includes('broken')) {
      severity = 'High';
    }

    return { category, severity, keywords: [] };
  }
};

module.exports = { analyzeWithGroq };
