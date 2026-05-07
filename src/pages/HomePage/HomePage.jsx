import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Upload, PenTool, CheckCircle, BarChart3, Layout, Timer, History, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AbstractHeroSVG = () => (
  <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto drop-shadow-xl">
    {/* Background Shape */}
    <rect x="40" y="40" width="320" height="320" rx="40" fill="#F8F9FA" stroke="#E5E7EB" strokeWidth="2" />
    
    {/* Abstract Paper */}
    <rect x="80" y="80" width="200" height="260" rx="12" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="2" />
    <line x1="110" y1="120" x2="250" y2="120" stroke="#E5E7EB" strokeWidth="4" strokeLinecap="round" />
    <line x1="110" y1="150" x2="230" y2="150" stroke="#E5E7EB" strokeWidth="4" strokeLinecap="round" />
    
    {/* MCQ Bubbles */}
    <circle cx="120" cy="200" r="10" fill="#F8F9FA" stroke="#E5E7EB" strokeWidth="2" />
    <circle cx="160" cy="200" r="10" fill="#4F46E5" />
    <circle cx="200" cy="200" r="10" fill="#F8F9FA" stroke="#E5E7EB" strokeWidth="2" />
    <circle cx="240" cy="200" r="10" fill="#F8F9FA" stroke="#E5E7EB" strokeWidth="2" />
    
    <circle cx="120" cy="240" r="10" fill="#F8F9FA" stroke="#E5E7EB" strokeWidth="2" />
    <circle cx="160" cy="240" r="10" fill="#F8F9FA" stroke="#E5E7EB" strokeWidth="2" />
    <circle cx="200" cy="240" r="10" fill="#10B981" />
    <circle cx="240" cy="240" r="10" fill="#F8F9FA" stroke="#E5E7EB" strokeWidth="2" />

    {/* Stylus / Pencil */}
    <path d="M280 140 L340 80 L360 100 L300 160 Z" fill="#4F46E5" />
    <path d="M280 140 L260 160 L300 160 Z" fill="#4338CA" />
    
    {/* Graph Overlay */}
    <path d="M220 320 C 260 320, 280 240, 340 280" stroke="#4F46E5" strokeWidth="4" strokeLinecap="round" fill="none" />
    <circle cx="340" cy="280" r="6" fill="#FFFFFF" stroke="#4F46E5" strokeWidth="3" />
  </svg>
);

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

export default function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background text-primary font-sans">
      {/* 1. Hero Section */}
      <section className="pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
        <motion.div 
          className="flex-1 space-y-8"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.h1 variants={fadeIn} className="text-5xl md:text-7xl font-bold tracking-tight text-primary leading-tight">
            Master A-Level MCQs <br/>
            <span className="text-accent">With Precision.</span>
          </motion.h1>
          <motion.p variants={fadeIn} className="text-xl text-secondary max-w-2xl leading-relaxed">
            Upload your past papers and marking schemes. Draw, annotate, and solve in a distraction-free digital environment designed for peak productivity.
          </motion.p>
          <motion.div variants={fadeIn} className="flex gap-4">
            {isAuthenticated ? (
              <Link to="/dashboard" className="bg-accent hover:bg-accentHover text-white px-8 py-4 rounded-xl font-medium transition-transform active:scale-95 shadow-soft flex items-center gap-2">
                Go to Dashboard
                <Layout size={18} />
              </Link>
            ) : (
              <Link to="/login" className="bg-accent hover:bg-accentHover text-white px-8 py-4 rounded-xl font-medium transition-transform active:scale-95 shadow-soft">
                Get Started Free
              </Link>
            )}
          </motion.div>
        </motion.div>
        <motion.div 
          className="flex-1 w-full max-w-lg"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
        >
          <AbstractHeroSVG />
        </motion.div>
      </section>

      {/* 2. How It Works Section */}
      <section className="py-24 bg-surface px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeIn}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-secondary text-lg">Three simple steps to streamline your past paper practice.</p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            {[
              { icon: Upload, title: "Upload Paper", desc: "Upload the question paper and marking scheme. We instantly extract the answers using local OCR." },
              { icon: PenTool, title: "Solve & Annotate", desc: "Use our robust digital toolkit to draw, highlight, and solve right on top of the PDF." },
              { icon: CheckCircle, title: "See Results", desc: "Get instant feedback, personalized stats, and review your weakest areas immediately." }
            ].map((step, idx) => (
              <motion.div key={idx} variants={fadeIn} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-white border border-border rounded-2xl shadow-soft flex items-center justify-center mb-6 text-accent">
                  <step.icon size={28} />
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-secondary leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 3. Features Grid */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <motion.div 
          className="mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeIn}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need</h2>
          <p className="text-secondary text-lg max-w-2xl">A tool suite designed specifically for A-Level students.</p>
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          {[
            { icon: PenTool, title: "Annotate Papers", desc: "Draw, highlight, and write text directly on the PDF. Persists across sessions." },
            { icon: Layout, title: "Digital Rough Page", desc: "A blank, infinite canvas sliding in when you need to do complex workings." },
            { icon: Timer, title: "Exam Mode", desc: "Simulate real exam pressure with a strict countdown timer and auto-submission." },
            { icon: Clock, title: "Casual Mode", desc: "Practice at your own pace with instant answer reveal and feedback after every question." },
            { icon: BarChart3, title: "Personalised Stats", desc: "Track time spent per question and monitor your accuracy over time." },
            { icon: History, title: "Saved History", desc: "Access your past attempts, complete with all your annotations and rough work intact." }
          ].map((feature, idx) => (
            <motion.div 
              key={idx} 
              variants={fadeIn} 
              className="p-8 bg-white border border-border rounded-2xl shadow-soft hover:shadow-md transition-shadow"
            >
              <feature.icon className="text-accent mb-5" size={24} />
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-secondary leading-relaxed text-sm">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* 4. Minimal Footer */}
      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <CheckCircle size={18} className="text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">PaperSolve</span>
          </div>
          <p className="text-secondary text-sm">© {new Date().getFullYear()} PaperSolve. Master your exams.</p>
          <div className="flex gap-6 text-sm text-secondary">
            <a href="#" className="hover:text-primary transition-colors">About</a>
            <a href="#" className="hover:text-primary transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
