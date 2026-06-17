/**
 * Lumina Production UI — Visual Transformation Script
 * This component injects global styles that override all existing inline styles
 * to create a production-grade edtech+SaaS appearance.
 */
import { useEffect } from 'react';

export const ProductionUI = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Force override all inline styles */
      body { background: #0a0a0f !important; color: #e4e4e7 !important; }
      
      /* Sidebar */
      [class*="sidebar"], [class*="Sidebar"] { 
        background: #0d0d12 !important; 
        border-right: 1px solid rgba(255,255,255,0.06) !important; 
      }
      
      /* All cards and panels */
      [class*="liquid-glass"], [class*="card"], [class*="Card"], [class*="panel"], [class*="Panel"] {
        background: rgba(255,255,255,0.03) !important;
        border: 1px solid rgba(255,255,255,0.06) !important;
        border-radius: 16px !important;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2) !important;
      }
      
      /* Chat page specific */
      .flex.h-full.bg-background, [class*="chat"] .flex.h-full { 
        background: #0a0a0f !important; 
      }
      
      /* Top bars */
      .h-14.shrink-0, [class*="top-bar"], [class*="header"] {
        background: rgba(10,10,15,0.85) !important;
        backdrop-filter: blur(20px) !important;
        border-bottom: 1px solid rgba(255,255,255,0.06) !important;
      }
      
      /* Logo icons - force gradient */
      .gradient-primary, [class*="gradient-primary"], .bg-gradient-to-br {
        background: linear-gradient(135deg, #14b8a6, #7c3aed) !important;
        box-shadow: 0 2px 10px rgba(20,184,166,0.3) !important;
      }
      
      /* Empty state icon */
      .flex-1.flex.flex-col.items-center.justify-center .w-16.h-16,
      .flex-1.flex.flex-col.items-center.justify-center .w-14.h-14 {
        background: linear-gradient(135deg, rgba(20,184,166,0.15), rgba(124,58,237,0.15)) !important;
        border: 1px solid rgba(20,184,166,0.15) !important;
        border-radius: 20px !important;
        width: 72px !important;
        height: 72px !important;
      }
      
      /* Empty state heading */
      .flex-1.flex.flex-col.items-center.justify-center h1 {
        font-size: 28px !important;
        font-weight: 700 !important;
        background: linear-gradient(135deg, #fff 0%, #a1a1aa 100%) !important;
        -webkit-background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
      }
      
      /* Suggestion cards */
      .flex-1.flex.flex-col.items-center.justify-center .grid button,
      .flex-1.flex.flex-col.items-center.justify-center .grid [class*="motion"] {
        background: rgba(255,255,255,0.03) !important;
        border: 1px solid rgba(255,255,255,0.06) !important;
        border-radius: 16px !important;
        padding: 16px 20px !important;
        transition: all 0.2s ease !important;
      }
      
      .flex-1.flex.flex-col.items-center.justify-center .grid button:hover {
        background: rgba(255,255,255,0.06) !important;
        border-color: rgba(20,184,166,0.2) !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
      }
      
      /* User message bubble */
      .rounded-2xl.bg-primary, [class*="bg-primary"][class*="rounded"] {
        background: linear-gradient(135deg, #14b8a6, #0d9488) !important;
        border-radius: 16px 16px 4px 16px !important;
        box-shadow: 0 2px 8px rgba(20,184,166,0.15) !important;
      }
      
      /* Input area */
      .shrink-0.pb-4, .shrink-0.pb-3 {
        background: linear-gradient(to top, #0a0a0f 70%, transparent) !important;
      }
      
      /* Scrollbar */
      ::-webkit-scrollbar { width: 6px !important; }
      ::-webkit-scrollbar-track { background: transparent !important; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08) !important; border-radius: 3px !important; }
      
      /* Text colors */
      .text-foreground { color: #e4e4e7 !important; }
      .text-muted-foreground { color: #71717a !important; }
      .text-primary { color: #14b8a6 !important; }
      .text-white { color: #e4e4e7 !important; }
      .text-white\\/40 { color: #71717a !important; }
      .text-white\\/70 { color: #a1a1aa !important; }
      .text-white\\/80 { color: #d4d4d8 !important; }
      
      /* Background colors */
      .bg-background { background: #0a0a0f !important; }
      .bg-card { background: rgba(255,255,255,0.03) !important; }
      .bg-card\\/40 { background: rgba(255,255,255,0.04) !important; }
      .bg-card\\/50 { background: rgba(255,255,255,0.05) !important; }
      .bg-card\\/60 { background: rgba(255,255,255,0.06) !important; }
      .bg-card\\/70 { background: rgba(255,255,255,0.07) !important; }
      
      /* Border colors */
      .border-border { border-color: rgba(255,255,255,0.06) !important; }
      .border-border\\/10 { border-color: rgba(255,255,255,0.1) !important; }
      .border-border\\/20 { border-color: rgba(255,255,255,0.15) !important; }
      .border-white\\[\\/0\\.06\\] { border-color: rgba(255,255,255,0.06) !important; }
      .border-white\\[\\/0\\.08\\] { border-color: rgba(255,255,255,0.08) !important; }
      .border-white\\[\\/0\\.10\\] { border-color: rgba(255,255,255,0.10) !important; }
      
      /* Hover states */
      .hover\\:bg-accent:hover { background: rgba(255,255,255,0.04) !important; }
      .hover\\:text-foreground:hover { color: #e4e4e7 !important; }
      .hover\\:border-primary\\/30:hover { border-color: rgba(20,184,166,0.3) !important; }
      .hover\\:border-primary\\/40:hover { border-color: rgba(20,184,166,0.4) !important; }
      
      /* Focus states */
      button:focus-visible, a:focus-visible {
        outline: 2px solid rgba(20,184,166,0.5) !important;
        outline-offset: 2px !important;
      }
      
      /* Selection */
      ::selection { background: rgba(20,184,166,0.25) !important; }
      
      /* Animations */
      @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes slideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
      
      /* Apply animations */
      [class*="sidebar"] { animation: slideIn 0.3s ease; }
      .flex-1.flex.flex-col.items-center.justify-center { animation: fadeIn 0.4s ease; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);
  
  return null;
};
