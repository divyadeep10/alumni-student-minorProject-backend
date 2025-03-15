const natural = require('natural');
// Fix the import - ml-distance exports an object with different distance functions
const mlDistance = require('ml-distance');
const { TfIdf } = require('natural');
const Student = require('../models/Student');
const Alumni = require('../models/Alumni');

// TF-IDF for text processing
const tfidf = new TfIdf();

// Tokenizer for text processing
const tokenizer = new natural.WordTokenizer();

// Calculate vector similarity between student and alumni
const calculateSimilarity = (studentVector, alumniVector) => {
  // Ensure vectors are of same length
  const keys = new Set([...Object.keys(studentVector), ...Object.keys(alumniVector)]);
  const normalizedStudentVector = [];
  const normalizedAlumniVector = [];
  
  keys.forEach(key => {
    normalizedStudentVector.push(studentVector[key] || 0);
    normalizedAlumniVector.push(alumniVector[key] || 0);
  });
  
  // Calculate dot product
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  
  for (let i = 0; i < normalizedStudentVector.length; i++) {
    dotProduct += normalizedStudentVector[i] * normalizedAlumniVector[i];
    magnitudeA += normalizedStudentVector[i] * normalizedStudentVector[i];
    magnitudeB += normalizedAlumniVector[i] * normalizedAlumniVector[i];
  }
  
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  
  // Handle edge case of zero magnitude
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  
  // Return cosine similarity
  return dotProduct / (magnitudeA * magnitudeB);
};

// Convert text to vector using TF-IDF
const textToVector = (text) => {
  if (!text) return {};
  
  const tokens = tokenizer.tokenize(text.toLowerCase());
  const vector = {};
  
  tfidf.addDocument(tokens);
  tokens.forEach(token => {
    vector[token] = tfidf.tfidf(token, 0);
  });
  
  return vector;
};

// Calculate availability match score
const calculateAvailabilityMatch = (studentAvailability, alumniAvailability) => {
  if (!studentAvailability || !alumniAvailability) return 0;
  
  let matchCount = 0;
  const totalSlots = Math.max(studentAvailability.length, 1);
  
  studentAvailability.forEach(studentSlot => {
    alumniAvailability.forEach(alumniSlot => {
      if (studentSlot.day === alumniSlot.day) {
        // Check if time slots overlap
        const studentStart = timeToMinutes(studentSlot.startTime);
        const studentEnd = timeToMinutes(studentSlot.endTime);
        const alumniStart = timeToMinutes(alumniSlot.startTime);
        const alumniEnd = timeToMinutes(alumniSlot.endTime);
        
        if (studentStart < alumniEnd && studentEnd > alumniStart) {
          matchCount++;
        }
      }
    });
  });
  
  return matchCount / totalSlots;
};

// Helper to convert time string to minutes
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Generate mentor recommendations for a student
const generateRecommendations = async (studentId, limit = 5) => {
  try {
    const student = await Student.findById(studentId);
    if (!student) throw new Error('Student not found');
    
    // Get all alumni
    const allAlumni = await Alumni.find({});
    
    // Calculate match scores
    const matchScores = await Promise.all(allAlumni.map(async (alumni) => {
      // Skip if already connected
      if (student.connections.includes(alumni._id)) return null;
      
      // Calculate interest-expertise match
      const interestVector = student.detailedInterests ? Object.fromEntries(student.detailedInterests) : {};
      const expertiseVector = alumni.expertiseAreas ? Object.fromEntries(alumni.expertiseAreas) : {};
      
      // Add text-based vectors
      const studentTextVector = textToVector(student.careerGoals);
      const alumniTextVector = textToVector(alumni.careerInsights);
      
      // Combine vectors
      const combinedStudentVector = { ...interestVector, ...studentTextVector };
      const combinedAlumniVector = { ...expertiseVector, ...alumniTextVector };
      
      // Calculate similarity score
      const similarityScore = calculateSimilarity(combinedStudentVector, combinedAlumniVector);
      
      // Calculate availability match
      const availabilityScore = calculateAvailabilityMatch(student.availability, alumni.availability);
      
      // Calculate communication preference match
      const communicationScore = student.communicationPreference === alumni.communicationPreference ? 1 : 0;
      
      // Apply weights based on student preferences
      const expertiseWeight = student.matchingPreferences?.expertiseImportance || 5;
      const availabilityWeight = student.matchingPreferences?.availabilityImportance || 3;
      const communicationWeight = student.matchingPreferences?.communicationImportance || 2;
      
      const totalWeight = expertiseWeight + availabilityWeight + communicationWeight;
      
      // Calculate weighted score
      const weightedScore = (
        (similarityScore * expertiseWeight) + 
        (availabilityScore * availabilityWeight) + 
        (communicationScore * communicationWeight)
      ) / totalWeight;
      
      return {
        alumni,
        score: weightedScore,
        similarityScore,
        availabilityScore,
        communicationScore
      };
    }));
    
    // Filter out null values and sort by score
    const validMatches = matchScores.filter(match => match !== null);
    const sortedMatches = validMatches.sort((a, b) => b.score - a.score);
    
    // Return top matches
    return sortedMatches.slice(0, limit);
  } catch (error) {
    console.error('Error generating recommendations:', error);
    throw error;
  }
};

// Record feedback for a match
const recordMatchFeedback = async (studentId, alumniId, rating, feedback) => {
  try {
    const student = await Student.findById(studentId);
    if (!student) throw new Error('Student not found');
    
    // Add feedback
    student.matchFeedback.push({
      alumniId,
      rating,
      feedback,
      createdAt: new Date()
    });
    
    await student.save();
    return true;
  } catch (error) {
    console.error('Error recording match feedback:', error);
    throw error;
  }
};

module.exports = {
  generateRecommendations,
  recordMatchFeedback
};