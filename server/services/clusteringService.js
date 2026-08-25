const { TfIdf } = require('natural');
const Complaint = require('../models/Complaint');

// Cosine Similarity between two fixed-length vectors
const getCosineSimilarity = (v1, v2) => {
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    for (let i = 0; i < v1.length; i++) {
        dotProduct += v1[i] * v2[i];
        mag1 += v1[i] * v1[i];
        mag2 += v2[i] * v2[i];
    }
    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);
    if (mag1 === 0 || mag2 === 0) return 0;
    return dotProduct / (mag1 * mag2);
};

const assignCluster = async (newText) => {
  try {
    // 1. Fetch only complaints that VALIDLY have a clusterId to avoid matching with undefined
    const previousComplaints = await Complaint.find({ clusterId: { $ne: null } }, 'text clusterId').sort({ createdAt: -1 });
    
    // If it's the very first valid complaint, start with ID 0
    if (previousComplaints.length === 0) return 0;

    // 2. Vectorize all texts
    const allTexts = [...previousComplaints.map(c => c.text), newText];
    const tfidf = new TfIdf();
    allTexts.forEach(t => tfidf.addDocument(t));

    const terms = new Set();
    allTexts.forEach((_, i) => {
        tfidf.listTerms(i).forEach(item => terms.add(item.term));
    });
    const termList = Array.from(terms);

    const vectors = allTexts.map((_, i) => {
        return termList.map(term => tfidf.tfidf(term, i));
    });

    const newVector = vectors[vectors.length - 1];

    // 3. Compare newVector with each PREVIOUS complaint
    let bestMatchId = null;
    let maxSimilarity = 0;

    for (let i = 0; i < previousComplaints.length; i++) {
        const sim = getCosineSimilarity(newVector, vectors[i]);
        // If we found a stronger match AND it has a valid clusterId
        if (sim > maxSimilarity && previousComplaints[i].clusterId !== undefined && previousComplaints[i].clusterId !== null) {
            maxSimilarity = sim;
            bestMatchId = previousComplaints[i].clusterId;
        }
    }

    // 4. LOGIC: Match found (> 75% similarity)
    if (maxSimilarity > 0.75 && bestMatchId !== null && !isNaN(bestMatchId)) {
        const id = Number(bestMatchId);
        console.log(`🎯 CLUSTER MATCH: ${Math.round(maxSimilarity*100)}% match. Grouping with #${id}`);
        return id;
    }

    // 5. NEW CLUSTER: Find next unique ID
    const validIds = previousComplaints.map(c => c.clusterId).filter(id => id !== null && id !== undefined && !isNaN(id));
    const nextId = validIds.length > 0 ? Math.max(...validIds) + 1 : 0;
    
    console.log(`✨ NEW CLUSTER: Assigned unique ID #${nextId}`);
    return Number(nextId);

  } catch (error) {
    console.error('⚠️ Clustering Critical Fallback:', error.message);
    return 0; // Return 0 instead of NaN to prevent DB crash
  }
};

module.exports = { assignCluster };
