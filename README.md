# 🎓 AI-Based Alumni–Student Mentoring and Career Guidance Portal

A full-stack AI-powered web application built to foster structured, scalable, and meaningful engagement between alumni and students for mentorship and career development.

## 📌 Project Summary

This platform uses AI to intelligently match students with alumni mentors based on interests, availability, and communication preferences. It integrates real-time communication, webinars, discussion forums, and an AI chatbot to provide a complete mentorship ecosystem.

## 🧠 Key Features

- 🔍 **AI-Powered Mentor Matching**  
  Utilizes NLP, TF-IDF, and cosine similarity for intelligent mentor-mentee pairing.

- 💬 **AI Chatbot for College Queries**  
  Built with RAG architecture using LangChain, FAISS, HuggingFace embeddings, and Google Gemini.

- 🎥 **WebRTC-Based Live Webinars**  
  Supports secure video mentoring and live sessions via peer-to-peer WebRTC.

- 📺 **YouTube API Integration**  
  Automatically uploads webinar recordings through OAuth2 authentication.

- 👥 **Role-Based Dashboards**  
  Separate functionalities for students, alumni, and admin using JWT auth and role-based access.

- 🛡️ **Secure Backend**  
  Includes bcrypt password hashing, CORS, input validation, and protected routes.

## 🛠️ Tech Stack

| Layer       | Technology                                    |
|-------------|-----------------------------------------------|
| Frontend    | React.js, Tailwind CSS, Framer Motion, Axios  |
| Backend     | Node.js, Express.js, MongoDB, Mongoose        |
| Real-Time   | WebRTC, Socket.IO                             |
| AI Chatbot  | Python, Flask, LangChain, FAISS, Gemini API   |
| Security    | JWT, bcrypt, CORS                             |
| Media API   | YouTube Data API v3, OAuth2                   |

## ⚙️ Architecture Overview

- **Frontend SPA** with React + Tailwind and protected role-based routing.
- **RESTful Backend** using Express with modularized controllers and services.
- **AI Matching Engine** powered by NLP and vector similarity metrics.
- **RAG-based Chatbot** integrates a semantically searchable college info dataset.
- **Live Communication** with WebRTC, ICE negotiation, and signaling via Socket.IO.
- **MongoDB Models** for Users, Mentorships, Webinars, and Discussions.

## 📊 System Flow

1. Users (students/alumni) register and log in.
2. Students set preferences (career goals, interests, time slots).
3. AI suggests alumni mentors based on vector similarity and availability overlap.
4. Mentorship requests are sent and managed.
5. Users can chat, join forums, and attend webinars.
6. Admins manage YouTube webinar uploads and monitor reports.
7. Chatbot answers college-related questions using contextual AI search.

## 📈 Performance Highlights

- Achieved **98% match score** with aligned mentor-mentee profiles.
- Validated through real-time test cases and user feedback.
- Backend endpoints for feedback, preferences, and reports tested with positive results.

## 📦 Future Enhancements

- 📱 Mobile App Version
- 🌍 Multilingual Chatbot Support
- 🧠 Deep Learning Mentor Matching (recommendation engine)
- 🏆 Gamification: Badges, Leaderboards
- 🔗 Blockchain-Based Mentorship Certificate Verification
- 📊 Admin Dashboards with Visual Analytics

## Backend Github 

- https://github.com/divyadeep10/alumni-student-minorProject-backend
