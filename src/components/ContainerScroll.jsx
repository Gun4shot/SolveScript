import { useEffect, useRef, useState } from 'react';
import { useScroll, useTransform } from 'framer-motion';
import './ContainerScroll.css';

// Adapted from 21st.dev's Container Scroll Animation (component id 1081).
export default function ContainerScroll({ title, children }) {
  const containerRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start end', 'end start'] });
  const rotateX = useTransform(scrollYProgress, [0.18, 0.65], [20, 0]);
  const scale = useTransform(scrollYProgress, [0.18, 0.65], isMobile ? [0.78, 1] : [1.07, 1]);
  const translateY = useTransform(scrollYProgress, [0.18, 0.65], [84, -72]);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= 768);
    update(); window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return <section className="container-scroll" ref={containerRef}>
    <motion.div className="container-scroll-title" style={{ y: translateY }}>{title}</motion.div>
    <div className="container-scroll-perspective"><motion.div className="container-scroll-card" style={{ rotateX, scale }}>{children}</motion.div></div>
  </section>;
}
