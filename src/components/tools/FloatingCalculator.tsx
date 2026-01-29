import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Calculator from '@/components/calculator/Calculator';

const STORAGE_KEY = 'floatingCalcWindowState';
const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 420;

interface WindowPosition {
  x: number;
  y: number;
}

export default function FloatingCalculator() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState<WindowPosition>({ x: window.innerWidth - DEFAULT_WIDTH - 20, y: window.innerHeight - DEFAULT_HEIGHT - 80 });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const windowRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0, windowX: 0, windowY: 0 });

  // Load position from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { x, y } = JSON.parse(saved);
        setPosition({ x, y });
      }
    } catch (err) {
      console.warn('Failed to load calculator window position:', err);
    }

    // Monitor window resize for mobile detection
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save position to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    } catch (err) {
      console.warn('Failed to save calculator window position:', err);
    }
  }, [position]);

  // Handle ESC key to close window
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  // Pointer event handlers for dragging
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!headerRef.current || !windowRef.current) return;
    
    // Only drag from header, not from buttons
    if ((e.target as HTMLElement).closest('button')) return;

    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      windowX: position.x,
      windowY: position.y,
    };

    headerRef.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartPos.current.x;
    const deltaY = e.clientY - dragStartPos.current.y;

    setPosition({
      x: dragStartPos.current.windowX + deltaX,
      y: dragStartPos.current.windowY + deltaY,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    headerRef.current?.releasePointerCapture(e.pointerId);
  };

  // Don't render if not open (save resources)
  if (!isOpen) {
    return createPortal(
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 40,
        }}
      >
        {/* Floating Action Button (FAB) */}
        <button
          onClick={() => setIsOpen(true)}
          title="Open calculator"
          className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center font-bold text-sm"
          style={{
            cursor: 'pointer',
          }}
        >
          Calc
        </button>
      </div>,
      document.body
    );
  }

  // Mobile layout: centered bottom sheet with subtle background
  if (isMobile) {
    return createPortal(
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          zIndex: 50,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          padding: '20px',
        }}
        onClick={() => setIsOpen(false)}
      >
        <div
          ref={windowRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: 'hsl(var(--background))',
            borderRadius: '12px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
          }}
        >
          {/* Header with close button */}
          <div
            ref={headerRef}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              backgroundColor: 'hsl(var(--muted))',
              borderBottom: '1px solid hsl(var(--border))',
              cursor: 'grab',
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Calculator</span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div style={{ padding: '16px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
            <Calculator showCard={false} />
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Desktop layout: floating window with drag
  return createPortal(
    <div
      ref={windowRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${DEFAULT_WIDTH}px`,
        zIndex: 50,
        backgroundColor: 'hsl(var(--background))',
        borderRadius: '8px',
        boxShadow: isDragging
          ? '0 20px 60px rgba(0, 0, 0, 0.4)'
          : '0 10px 40px rgba(0, 0, 0, 0.2)',
        overflow: 'hidden',
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease-out',
      }}
    >
      {/* Header with drag handle and controls */}
      <div
        ref={headerRef}
        onPointerDown={handlePointerDown}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          backgroundColor: 'hsl(var(--muted))',
          borderBottom: '1px solid hsl(var(--border))',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: 600 }}>Calculator</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-6 w-6"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsOpen(false)}
            className="h-6 w-6"
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content (hidden when minimized) */}
      {!isMinimized && (
        <div style={{ padding: '16px', maxHeight: `${DEFAULT_HEIGHT - 48}px`, overflowY: 'auto' }}>
          <Calculator showCard={false} />
        </div>
      )}
    </div>,
    document.body
  );
}
