'use client';

import { useState, ReactNode } from 'react';
import '../styles/mobile-tesla.css';

interface MobileWrapperProps {
  children: ReactNode;
}

export function MobileWrapper({ children }: MobileWrapperProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <>
      {/* Mobile Header - only shows on mobile */}
      <div className="mobile-header">
        <button
          className={`mobile-hamburger ${isSidebarOpen ? 'active' : ''}`}
          onClick={toggleSidebar}
          aria-label="Menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        
        <div className="text-xl font-bold tracking-tight">Always</div>
        
        <div className="w-10 h-10 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
        </div>
      </div>

      {/* Mobile Overlay */}
      <div
        className={`mobile-overlay ${isSidebarOpen ? 'show' : ''}`}
        onClick={closeSidebar}
      />

      {/* Mobile Sidebar */}
      <div className={`mobile-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="p-6 border-b border-white/10">
          <div className="text-sm text-gray-500 uppercase tracking-wider font-semibold mb-2">
            Control Panel
          </div>
          <div className="text-lg font-semibold">Ricardo Rodriguez</div>
        </div>

        <div className="py-4">
          <nav className="space-y-1">
            <button
              onClick={closeSidebar}
              className="w-full flex items-center gap-4 px-6 py-3 text-left hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-blue-500"
            >
              <span className="text-xl">🏠</span>
              <span className="font-medium">Home</span>
            </button>
            
            <button
              onClick={closeSidebar}
              className="w-full flex items-center gap-4 px-6 py-3 text-left hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-blue-500"
            >
              <span className="text-xl">📝</span>
              <span className="font-medium">Transcripts</span>
            </button>
            
            <button
              onClick={closeSidebar}
              className="w-full flex items-center gap-4 px-6 py-3 text-left hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-blue-500"
            >
              <span className="text-xl">🔍</span>
              <span className="font-medium">Search</span>
            </button>
            
            <button
              onClick={closeSidebar}
              className="w-full flex items-center gap-4 px-6 py-3 text-left hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-blue-500"
            >
              <span className="text-xl">📊</span>
              <span className="font-medium">Analytics</span>
            </button>
            
            <button
              onClick={closeSidebar}
              className="w-full flex items-center gap-4 px-6 py-3 text-left hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-blue-500"
            >
              <span className="text-xl">⚙️</span>
              <span className="font-medium">Settings</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content - wrapped with mobile spacing */}
      <div className="mobile-main-content">
        {children}
      </div>
    </>
  );
}
