import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import logoImage from "@/assets/bouncing-logo.png";

interface Logo {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
}

const BouncingLogos = () => {
  const location = useLocation();
  const isAdminDashboard = location.pathname.startsWith("/dashboard");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logosRef = useRef<Logo[]>([]);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to full viewport; we'll clip near footer dynamically
    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    updateCanvasSize();

    // Load image
    const img = new Image();
    img.src = logoImage;
    imageRef.current = img;

    img.onload = () => {
      // Initialize logos; y seeded within current visible area above footer if present
      const numLogos = 15;
      const footer = document.querySelector("footer");
      const footerTop = footer ? footer.getBoundingClientRect().top : window.innerHeight;
      const boundaryHeight = Math.min(canvas.height, footerTop > 0 ? Math.min(footerTop, window.innerHeight) : canvas.height);

      logosRef.current = Array.from({ length: numLogos }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * boundaryHeight,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        size: 60 + Math.random() * 60,
      }));

      // Animation loop
      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Compute dynamic boundary based on footer position in viewport
        const footer = document.querySelector("footer");
        const footerTop = footer ? (footer as HTMLElement).getBoundingClientRect().top : window.innerHeight;
        const boundaryHeight = Math.min(canvas.height, footerTop > 0 ? Math.min(footerTop, window.innerHeight) : canvas.height);

        logosRef.current.forEach((logo) => {
          // Update position
          logo.x += logo.vx;
          logo.y += logo.vy;

          // Bounce off walls, keep below top and above dynamic boundary
          if (logo.x - logo.size / 2 <= 0 || logo.x + logo.size / 2 >= canvas.width) {
            logo.vx *= -1;
            logo.x = Math.max(logo.size / 2, Math.min(canvas.width - logo.size / 2, logo.x));
          }
          if (logo.y - logo.size / 2 <= 0 || logo.y + logo.size / 2 >= boundaryHeight) {
            logo.vy *= -1;
            logo.y = Math.max(logo.size / 2, Math.min(boundaryHeight - logo.size / 2, logo.y));
          }

          // Update rotation
          logo.rotation += logo.rotationSpeed;

          // Draw logo
          ctx.save();
          ctx.globalAlpha = 0.15;
          ctx.translate(logo.x, logo.y);
          ctx.rotate(logo.rotation);
          ctx.drawImage(
            img,
            -logo.size / 2,
            -logo.size / 2,
            logo.size,
            logo.size
          );
          ctx.restore();
        });

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animate();
    };

    // Handle resize
    const handleResize = () => {
      updateCanvasSize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  if (isAdminDashboard) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10"
      style={{ opacity: 1 }}
    />
  );
};

export default BouncingLogos;
