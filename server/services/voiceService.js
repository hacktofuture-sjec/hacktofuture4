const axios = require('axios');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { processNewComplaint } = require('./complaintService');
const { sendComplaintSMS } = require('./notificationService');

// In-memory call sessions store: sessionId -> state
const voiceSessions = new Map();

/**
 * Geocode spoken text address using OpenStreetMap Nominatim
 */
const geocodeAddress = async (address) => {
  try {
    if (!address || address.trim().length < 3) {
      return { lat: 12.9141, lng: 74.8560, formattedAddress: 'Mangalore Smart City' };
    }
    const cleanAddr = encodeURIComponent(address.trim());
    const res = await axios.get(`https://nominatim.openstreetmap.org/search?q=${cleanAddr}&format=json&limit=1`, {
      headers: { 'User-Agent': 'JanSetu-Voice-AI/1.0' },
      timeout: 5000
    });
    if (res.data && res.data.length > 0) {
      return {
        lat: parseFloat(res.data[0].lat),
        lng: parseFloat(res.data[0].lon),
        formattedAddress: res.data[0].display_name
      };
    }
  } catch (err) {
    console.error('⚠️ Geocoding failed for voice address:', err.message);
  }
  return { lat: 12.9141, lng: 74.8560, formattedAddress: address };
};

/**
 * Understand voice turn using Groq AI
 */
const analyzeVoiceInput = async (spokenText, sessionContext = {}) => {
  try {
    const prompt = `You are an intelligent Voice Call Assistant for "JanSetu Smart City Grievance Redressal Helpline".
You are speaking to a citizen on a live phone call.
Previous Context: ${JSON.stringify(sessionContext)}
Caller just said: "${spokenText}"

Task:
1. Determine intent: "REPORT_ISSUE" (reporting civic issue), "CHECK_STATUS" (asking about complaint), "GREETING", or "GENERAL_QUERY".
2. Extract:
   - "issueDescription": What is broken/wrong? (Merge with previous context if any)
   - "location": Spoken landmark, street, neighborhood, or city mentioned. (Merge with previous context if any)
3. Check completeness: Is there ENOUGH info to file the ticket? (Need both a clear issue description AND a location or landmark).
4. Generate "spokenReply":
   - If information is MISSING (e.g. location is missing): Ask the caller naturally and briefly for the missing detail.
   - If ready to file: Give a brief, courteous confirmation that the issue is being registered.
   - If general query or greeting: Give a polite, concise voice response.

Return ONLY a valid JSON object:
{
  "intent": "REPORT_ISSUE" | "CHECK_STATUS" | "GREETING" | "GENERAL_QUERY",
  "issueDescription": "...",
  "location": "...",
  "isComplete": true | false,
  "missingField": "location" | "issue" | null,
  "spokenReply": "..."
}`;

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000
      }
    );

    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    console.error('⚠️ Groq Voice AI fallback:', error.message);
    const lower = spokenText.toLowerCase();
    const hasLocation = /road|street|nagar|cross|junction|circle|near|hospital|colony|market|bus stand|station/i.test(lower);
    return {
      intent: "REPORT_ISSUE",
      issueDescription: spokenText,
      location: hasLocation ? spokenText : "Central District",
      isComplete: hasLocation,
      missingField: hasLocation ? null : "location",
      spokenReply: hasLocation 
        ? "Thank you. I have registered your report and alerted the municipal team." 
        : "Could you please tell me which street, area, or landmark this issue is located at?"
    };
  }
};

/**
 * Main handler for a voice conversation turn
 */
const handleVoiceTurn = async ({ sessionId, callerPhone, speechResult, isWeb = false }) => {
  let session = voiceSessions.get(sessionId) || {
    step: 'GREETED',
    collectedIssue: '',
    collectedLocation: '',
    turns: 0
  };

  session.turns += 1;

  if (!speechResult || speechResult.trim().length === 0) {
    return {
      session,
      spokenReply: "I didn't quite catch that. Could you please describe the civic problem you would like to report?",
      isFinished: false,
      complaint: null
    };
  }

  // Analyze the speech input in context of session
  const aiResult = await analyzeVoiceInput(speechResult, {
    issue: session.collectedIssue,
    location: session.collectedLocation
  });

  console.log(`🎙️ Voice Turn [${sessionId}] -> Intent: ${aiResult.intent}, Complete: ${aiResult.isComplete}`);

  if (aiResult.issueDescription) session.collectedIssue = aiResult.issueDescription;
  if (aiResult.location) session.collectedLocation = aiResult.location;

  // If we have enough info to log the complaint
  if (aiResult.isComplete || session.turns >= 3) {
    const finalTitle = session.collectedIssue || speechResult;
    const finalLocation = session.collectedLocation || "Smart City Central";

    // Geocode spoken location
    const { lat, lng, formattedAddress } = await geocodeAddress(finalLocation);

    // Identify or create citizen user
    const cleanPhone = (callerPhone || '9999999999').replace(/[^0-9+]/g, '');
    let user = await User.findOne({ phoneNumber: cleanPhone });
    if (!user) {
      user = await User.create({
        name: `Caller ${cleanPhone.slice(-4)}`,
        email: `voice_${cleanPhone.replace('+', '')}@jansetu.city`,
        phoneNumber: cleanPhone,
        password: "voiceCitizenTempPass123"
      });
    }

    // Process new complaint through JanSetu AI Engine
    const complaint = await processNewComplaint({
      title: finalTitle,
      location: formattedAddress,
      userId: user._id,
      lat,
      lng,
      imageUrl: null,
      userEmail: user.email.includes('@jansetu.city') ? null : user.email
    });

    // Send SMS Confirmation if phone number is available
    if (callerPhone && !isWeb) {
      await sendComplaintSMS(callerPhone, complaint);
    }

    const ticketId = complaint._id.toString().slice(-6);
    const spokenReply = `Thank you! Your complaint has been successfully registered with Ticket ID ${ticketId.split('').join(' ')}. It has been assigned to the ${complaint.department} department with ${complaint.priority} priority. An SMS confirmation has been sent to your number. Have a nice day!`;

    // Clear session
    voiceSessions.delete(sessionId);

    return {
      session: null,
      spokenReply,
      isFinished: true,
      complaint
    };
  }

  // Otherwise, ask for missing details
  voiceSessions.set(sessionId, session);
  return {
    session,
    spokenReply: aiResult.spokenReply || "Please tell me the location or landmark of the issue.",
    isFinished: false,
    complaint: null
  };
};

module.exports = {
  handleVoiceTurn,
  voiceSessions
};
