# PaperSolve — A-Level MCQ Solver

A full-stack, AI-inspired web application specifically built to digitalize and streamline the process of solving Cambridge A-Level Multiple Choice Question (MCQ) past papers.

## Features

- **Interactive PDF Viewer**: Powered by `react-pdf` with a custom `Fabric.js` annotation layer. Draw, highlight, add text, and draw shapes directly on the question paper.
- **Automated Marking Scheme Parsing**: Upload any standard Cambridge marking scheme PDF, and the app's regex-based engine automatically extracts the 40 answers. No more manual checking!
- **Exam vs. Casual Modes**: 
  - *Exam Mode* simulates real conditions with a customizable countdown timer, strict tracking, and no peeking at answers.
  - *Casual Mode* lets you practice at your own pace with instant answer feedback.
- **Advanced Analytics & Tracking**: Tracks time spent per question and provides a visual breakdown of your performance after every paper.
- **Rough Work Page**: A built-in, expandable digital scratchpad for calculations so you never need physical paper.
- **Guest Mode Support**: Jump right in and start solving without needing an account.
- **Beautiful UI**: Modern, glassmorphism-heavy dark theme with sleek micro-animations and responsive layouts.

## Tech Stack

### Frontend
- **React 19** + **Vite 8**
- **Fabric.js** (Canvas rendering & drawing tools)
- **React-PDF** (PDF rendering)
- **Vanilla CSS** (Custom CSS variables and token system)

### Backend
- **Node.js** + **Express**
- **MongoDB** + **Mongoose** (Database)
- **JWT** (HTTP-only cookies for secure authentication)
- **Bcrypt.js** (Password hashing)
- **Multer** + **pdf-parse** (File uploads and PDF text extraction)

## Quick Start

### Prerequisites
- Node.js (v18+)
- MongoDB (Running locally or an Atlas URI)

### 1. Setup Backend
```bash
cd server
npm install

# Create a .env file based on the environment variables needed
# Set your MONGODB_URI and JWT Secrets
npm run dev
```
*The backend will run on `http://localhost:5000`*

### 2. Setup Frontend
```bash
# From the root directory
npm install
npm run dev
```
*The frontend will run on `http://localhost:5173` and will proxy API requests to the backend.*

## License
MIT License
