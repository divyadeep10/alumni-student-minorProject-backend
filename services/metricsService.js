const Student = require('../models/Student');
const Alumni = require('../models/Alumni');
const matchingService = require('./matchingService');

/**
 * Calculates performance metrics for the matching system
 */
const calculateMatchingMetrics = async () => {
  try {
    // Get all students with feedback
    const studentsWithFeedback = await Student.find({
      'matchFeedback.0': { $exists: true }
    });
    
    // Calculate overall satisfaction rate
    let totalRatings = 0;
    let totalFeedbackCount = 0;
    
    // Track feedback by category
    const feedbackByScore = {
      excellent: 0, // 5
      good: 0,      // 4
      average: 0,   // 3
      fair: 0,      // 2
      poor: 0       // 1
    };
    
    // Process all feedback
    studentsWithFeedback.forEach(student => {
      student.matchFeedback.forEach(feedback => {
        totalRatings += feedback.rating;
        totalFeedbackCount++;
        
        // Categorize feedback
        if (feedback.rating === 5) feedbackByScore.excellent++;
        else if (feedback.rating === 4) feedbackByScore.good++;
        else if (feedback.rating === 3) feedbackByScore.average++;
        else if (feedback.rating === 2) feedbackByScore.fair++;
        else if (feedback.rating === 1) feedbackByScore.poor++;
      });
    });
    
    // Calculate average satisfaction
    const averageSatisfaction = totalFeedbackCount > 0 
      ? (totalRatings / totalFeedbackCount).toFixed(2) 
      : 0;
    
    // Calculate percentage distribution
    const feedbackDistribution = {};
    if (totalFeedbackCount > 0) {
      feedbackDistribution.excellent = ((feedbackByScore.excellent / totalFeedbackCount) * 100).toFixed(1);
      feedbackDistribution.good = ((feedbackByScore.good / totalFeedbackCount) * 100).toFixed(1);
      feedbackDistribution.average = ((feedbackByScore.average / totalFeedbackCount) * 100).toFixed(1);
      feedbackDistribution.fair = ((feedbackByScore.fair / totalFeedbackCount) * 100).toFixed(1);
      feedbackDistribution.poor = ((feedbackByScore.poor / totalFeedbackCount) * 100).toFixed(1);
    }
    
    // Get algorithm performance metrics
    const algorithmMetrics = await calculateAlgorithmPerformance();
    
    return {
      overallMetrics: {
        totalStudentsWithFeedback: studentsWithFeedback.length,
        totalFeedbackCount,
        averageSatisfaction,
        feedbackDistribution
      },
      algorithmMetrics
    };
  } catch (error) {
    console.error('Error calculating matching metrics:', error);
    throw error;
  }
};

/**
 * Calculates algorithm performance metrics
 */
const calculateAlgorithmPerformance = async () => {
  try {
    // Get all students and alumni
    const students = await Student.find({});
    const alumni = await Alumni.find({});
    
    // Sample size for performance testing
    const sampleSize = Math.min(students.length, 10);
    
    // Track metrics
    let totalPrecision = 0;
    let totalRecall = 0;
    let totalF1Score = 0;
    
    // For each student in the sample, calculate precision and recall
    const sampleStudents = students.slice(0, sampleSize);
    
    for (const student of sampleStudents) {
      // Get actual connections
      const actualConnections = student.connections || [];
      
      // Get algorithm recommendations
      const recommendations = await matchingService.generateRecommendations(student._id, 5);
      const recommendedAlumniIds = recommendations.map(rec => rec.alumni._id.toString());
      
      // Calculate precision: What percentage of recommended alumni are actual connections
      const correctRecommendations = recommendedAlumniIds.filter(id => 
        actualConnections.some(connId => connId.toString() === id)
      );
      
      const precision = recommendedAlumniIds.length > 0 
        ? correctRecommendations.length / recommendedAlumniIds.length 
        : 0;
      
      // Calculate recall: What percentage of actual connections were recommended
      const recall = actualConnections.length > 0 
        ? correctRecommendations.length / actualConnections.length 
        : 0;
      
      // Calculate F1 score
      const f1Score = precision + recall > 0 
        ? 2 * (precision * recall) / (precision + recall) 
        : 0;
      
      totalPrecision += precision;
      totalRecall += recall;
      totalF1Score += f1Score;
    }
    
    // Calculate averages
    const avgPrecision = sampleStudents.length > 0 ? (totalPrecision / sampleStudents.length).toFixed(2) : 0;
    const avgRecall = sampleStudents.length > 0 ? (totalRecall / sampleStudents.length).toFixed(2) : 0;
    const avgF1Score = sampleStudents.length > 0 ? (totalF1Score / sampleStudents.length).toFixed(2) : 0;
    
    // Calculate similarity score distribution
    const similarityScores = [];
    for (const student of sampleStudents) {
      const recommendations = await matchingService.generateRecommendations(student._id, 5);
      recommendations.forEach(rec => {
        similarityScores.push(rec.similarityScore);
      });
    }
    
    // Calculate similarity score distribution
    const scoreDistribution = {
      veryHigh: 0, // 0.8-1.0
      high: 0,     // 0.6-0.8
      medium: 0,   // 0.4-0.6
      low: 0,      // 0.2-0.4
      veryLow: 0   // 0.0-0.2
    };
    
    similarityScores.forEach(score => {
      if (score >= 0.8) scoreDistribution.veryHigh++;
      else if (score >= 0.6) scoreDistribution.high++;
      else if (score >= 0.4) scoreDistribution.medium++;
      else if (score >= 0.2) scoreDistribution.low++;
      else scoreDistribution.veryLow++;
    });
    
    // Convert to percentages
    const totalScores = similarityScores.length;
    if (totalScores > 0) {
      scoreDistribution.veryHigh = ((scoreDistribution.veryHigh / totalScores) * 100).toFixed(1);
      scoreDistribution.high = ((scoreDistribution.high / totalScores) * 100).toFixed(1);
      scoreDistribution.medium = ((scoreDistribution.medium / totalScores) * 100).toFixed(1);
      scoreDistribution.low = ((scoreDistribution.low / totalScores) * 100).toFixed(1);
      scoreDistribution.veryLow = ((scoreDistribution.veryLow / totalScores) * 100).toFixed(1);
    }
    
    return {
      precision: avgPrecision,
      recall: avgRecall,
      f1Score: avgF1Score,
      sampleSize,
      similarityScoreDistribution: scoreDistribution
    };
  } catch (error) {
    console.error('Error calculating algorithm performance:', error);
    throw error;
  }
};

/**
 * Generates a CSV report of matching metrics
 */
const generateCSVReport = async () => {
  try {
    const metrics = await calculateMatchingMetrics();
    
    // Create CSV header
    let csv = 'Metric,Value\n';
    
    // Add overall metrics
    csv += `Total Students With Feedback,${metrics.overallMetrics.totalStudentsWithFeedback}\n`;
    csv += `Total Feedback Count,${metrics.overallMetrics.totalFeedbackCount}\n`;
    csv += `Average Satisfaction,${metrics.overallMetrics.averageSatisfaction}\n\n`;
    
    // Add feedback distribution
    csv += 'Feedback Distribution\n';
    csv += `Excellent,${metrics.overallMetrics.feedbackDistribution.excellent}%\n`;
    csv += `Good,${metrics.overallMetrics.feedbackDistribution.good}%\n`;
    csv += `Average,${metrics.overallMetrics.feedbackDistribution.average}%\n`;
    csv += `Fair,${metrics.overallMetrics.feedbackDistribution.fair}%\n`;
    csv += `Poor,${metrics.overallMetrics.feedbackDistribution.poor}%\n\n`;
    
    // Add algorithm metrics
    csv += 'Algorithm Performance\n';
    csv += `Precision,${metrics.algorithmMetrics.precision}\n`;
    csv += `Recall,${metrics.algorithmMetrics.recall}\n`;
    csv += `F1 Score,${metrics.algorithmMetrics.f1Score}\n`;
    csv += `Sample Size,${metrics.algorithmMetrics.sampleSize}\n\n`;
    
    // Add similarity score distribution
    csv += 'Similarity Score Distribution\n';
    csv += `Very High (0.8-1.0),${metrics.algorithmMetrics.similarityScoreDistribution.veryHigh}%\n`;
    csv += `High (0.6-0.8),${metrics.algorithmMetrics.similarityScoreDistribution.high}%\n`;
    csv += `Medium (0.4-0.6),${metrics.algorithmMetrics.similarityScoreDistribution.medium}%\n`;
    csv += `Low (0.2-0.4),${metrics.algorithmMetrics.similarityScoreDistribution.low}%\n`;
    csv += `Very Low (0.0-0.2),${metrics.algorithmMetrics.similarityScoreDistribution.veryLow}%\n`;
    
    return csv;
  } catch (error) {
    console.error('Error generating CSV report:', error);
    throw error;
  }
};

module.exports = {
  calculateMatchingMetrics,
  generateCSVReport
};