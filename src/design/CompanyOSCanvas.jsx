import React, { useState } from 'react';
import { Minus, Plus, Maximize2 } from 'lucide-react';

// Navigation/selection belongs to the shell; this frame owns only the viewport.
// Flow may supply graph scale and fit geometry; responsive Company/Work fit at 100%.
export default function CompanyOSCanvas({ children, className = '', zoom: controlledZoom, onZoom, onFit, canvasRef, ...props }) {
  const [localZoom, setLocalZoom] = useState(1);
  const zoom = controlledZoom ?? localZoom;
  const changeZoom = onZoom || setLocalZoom;
  return <main {...props} className={`cos-canvas cos-canvas--diagram cos-canvas-frame ${className}`} ref={canvasRef}>
    <div className="cos-canvas-scroll">
      <div className="cos-canvas-content" style={controlledZoom == null ? { zoom } : undefined}>{children}</div>
    </div>
    <nav className="cos-canvas-tools" aria-label="Diagram zoom">
      <button type="button" aria-label="Zoom out" disabled={zoom <= .3} onClick={() => changeZoom(Math.max(.3, zoom - .1))}><Minus size={15}/></button>
      <button type="button" aria-label="Reset zoom" onClick={() => changeZoom(1)}>{Math.round(zoom * 100)}%</button>
      <button type="button" aria-label="Zoom in" disabled={zoom >= 1.5} onClick={() => changeZoom(Math.min(1.5, zoom + .1))}><Plus size={15}/></button>
      <button type="button" onClick={onFit || (() => changeZoom(1))}><Maximize2 size={15}/>Fit</button>
    </nav>
  </main>;
}
