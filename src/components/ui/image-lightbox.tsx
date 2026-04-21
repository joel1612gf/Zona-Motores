'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { any } from '@/lib/types';

interface ImageLightboxProps {
  images: any[];
  isOpen: boolean;
  onClose: () => void;
  initialIndex?: number;
  title?: string;
  description?: string;
}

export function ImageLightbox({
  images,
  isOpen,
  onClose,
  initialIndex = 0,
  title = "Galería de Imágenes",
  description = "Visor de imágenes. Usa la rueda del ratón o pellizca para hacer zoom. Arrastra para mover la imagen."
}: ImageLightboxProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);

  // Sync initialIndex when lightbox opens
  useEffect(() => {
    if (isOpen) {
      setCurrentImageIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  // Ref-based zoom/pan for smooth, GPU-accelerated transforms (no React re-renders)
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const lightboxImageRef = useRef<HTMLImageElement>(null);
  const initialTouchState = useRef({ distance: 0, scale: 1, midX: 0, midY: 0, startX: 0, startY: 0 });
  const lastTapRef = useRef(0);
  const swipeRef = useRef({ startX: 0, startY: 0, swiping: false });

  const applyTransform = useCallback((animate = false) => {
    const el = lightboxImageRef.current;
    if (!el) return;
    const { scale, x, y } = transformRef.current;
    el.style.transition = animate ? 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none';
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  }, []);

  const resetZoom = useCallback((animate = false) => {
    transformRef.current = { scale: 1, x: 0, y: 0 };
    applyTransform(animate);
    setIsZoomed(false);
  }, [applyTransform]);

  useEffect(() => {
    resetZoom(false);
  }, [isOpen, currentImageIndex, resetZoom]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetZoom(false);
      isPanningRef.current = false;
      onClose();
    }
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
  };

  // Zoom/Pan Handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const t = transformRef.current;
    const scaleAmount = -e.deltaY * 0.003;
    const newScale = Math.max(1, Math.min(t.scale + scaleAmount * t.scale, 5));
    if (newScale === 1) {
      transformRef.current = { scale: 1, x: 0, y: 0 };
      applyTransform(true);
      setIsZoomed(false);
    } else {
      const container = imageContainerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const cx = e.clientX - rect.left - rect.width / 2;
        const cy = e.clientY - rect.top - rect.height / 2;
        const factor = newScale / t.scale;
        transformRef.current = { scale: newScale, x: cx - factor * (cx - t.x), y: cy - factor * (cy - t.y) };
      } else {
        transformRef.current = { ...t, scale: newScale };
      }
      applyTransform(false);
      setIsZoomed(true);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || transformRef.current.scale <= 1) return;
    e.preventDefault();
    isPanningRef.current = true;
    panStart.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
    if (imageContainerRef.current) imageContainerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    e.preventDefault();
    transformRef.current.x = e.clientX - panStart.current.x;
    transformRef.current.y = e.clientY - panStart.current.y;
    applyTransform(false);
  };

  const handleMouseUpOrLeave = () => {
    isPanningRef.current = false;
    if (imageContainerRef.current && transformRef.current.scale > 1) imageContainerRef.current.style.cursor = 'grab';
  };

  const getDistance = (touches: React.TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  const getMidpoint = (touches: React.TouchList) => ({ x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 });

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      isPanningRef.current = false;
      swipeRef.current.swiping = false;
      const mid = getMidpoint(e.touches);
      initialTouchState.current = {
        distance: getDistance(e.touches),
        scale: transformRef.current.scale,
        midX: mid.x,
        midY: mid.y,
        startX: transformRef.current.x,
        startY: transformRef.current.y,
      };
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        e.preventDefault();
        if (transformRef.current.scale > 1) {
          resetZoom(true);
        } else {
          const container = imageContainerRef.current;
          if (container) {
            const rect = container.getBoundingClientRect();
            const cx = e.touches[0].clientX - rect.left - rect.width / 2;
            const cy = e.touches[0].clientY - rect.top - rect.height / 2;
            transformRef.current = { scale: 2.5, x: cx - 2.5 * cx, y: cy - 2.5 * cy };
            applyTransform(true);
            setIsZoomed(true);
          }
        }
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;
      if (transformRef.current.scale > 1) {
        e.preventDefault();
        isPanningRef.current = true;
        panStart.current = { x: e.touches[0].clientX - transformRef.current.x, y: e.touches[0].clientY - transformRef.current.y };
      } else {
        swipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, swiping: true };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const newDistance = getDistance(e.touches);
      const newScale = Math.max(1, Math.min((newDistance / initialTouchState.current.distance) * initialTouchState.current.scale, 5));
      const container = imageContainerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const mid = getMidpoint(e.touches);
        const cx = mid.x - rect.left - rect.width / 2;
        const cy = mid.y - rect.top - rect.height / 2;
        const initCx = initialTouchState.current.midX - rect.left - rect.width / 2;
        const initCy = initialTouchState.current.midY - rect.top - rect.height / 2;
        const factor = newScale / initialTouchState.current.scale;
        const { startX, startY } = initialTouchState.current;
        transformRef.current = {
          scale: newScale,
          x: cx - factor * (initCx - startX),
          y: cy - factor * (initCy - startY),
        };
      } else {
        transformRef.current.scale = newScale;
      }
      applyTransform(false);
      setIsZoomed(newScale > 1);
    } else if (e.touches.length === 1 && isPanningRef.current) {
      e.preventDefault();
      transformRef.current.x = e.touches[0].clientX - panStart.current.x;
      transformRef.current.y = e.touches[0].clientY - panStart.current.y;
      applyTransform(false);
    } else if (e.touches.length === 1 && swipeRef.current.swiping) {
      const deltaX = e.touches[0].clientX - swipeRef.current.startX;
      const deltaY = e.touches[0].clientY - swipeRef.current.startY;
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 20) {
        swipeRef.current.swiping = false;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeRef.current.swiping && transformRef.current.scale <= 1 && e.changedTouches.length > 0) {
      const deltaX = e.changedTouches[0].clientX - swipeRef.current.startX;
      if (Math.abs(deltaX) > 50 && images.length > 1) {
        if (deltaX < 0) {
          setCurrentImageIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
        } else {
          setCurrentImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
        }
      }
      swipeRef.current.swiping = false;
    }
    isPanningRef.current = false;
    if (transformRef.current.scale <= 1.05) resetZoom(true);
  };

  if (!images || images.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[100vw] sm:max-w-screen-xl max-h-[100vh] w-full h-[100dvh] sm:h-[90vh] p-0 border-none bg-black/95 flex items-center justify-center overflow-hidden z-[100]">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>

        <div
          ref={imageContainerRef}
          className={cn(
            "relative w-full h-full select-none flex items-center justify-center",
            isZoomed ? 'cursor-grab' : 'cursor-auto'
          )}
          style={{ touchAction: 'none' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {images[currentImageIndex] && (
            <div className="relative w-full h-full max-h-[100dvh] flex items-center justify-center p-2 sm:p-4">
              <Image
                ref={lightboxImageRef}
                key={currentImageIndex}
                src={images[currentImageIndex].url}
                alt={images[currentImageIndex].alt || 'Imagen'}
                fill
                className="object-contain"
                style={{
                  willChange: 'transform',
                  transformOrigin: 'center center',
                  cursor: 'inherit',
                }}
                sizes="100vw"
                draggable="false"
                priority
              />
            </div>
          )}
        </div>

        {images.length > 1 && !isZoomed && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/50 text-white hover:bg-black/80 hover:text-white z-20 shadow-md backdrop-blur-sm"
              onClick={handlePrevImage}
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="sr-only">Anterior</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/50 text-white hover:bg-black/80 hover:text-white z-20 shadow-md backdrop-blur-sm"
              onClick={handleNextImage}
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="sr-only">Siguiente</span>
            </Button>
          </>
        )}

        <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none z-20">
          <div className="bg-black/50 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm shadow-md">
            {currentImageIndex + 1} / {images.length}
          </div>
        </div>

        <DialogClose asChild>
          <button className="absolute right-2 sm:right-4 top-2 sm:top-4 rounded-full p-2 bg-black/50 text-white hover:bg-black/80 hover:text-white z-20 transition-colors shadow-md backdrop-blur-sm">
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="sr-only">Cerrar</span>
          </button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
