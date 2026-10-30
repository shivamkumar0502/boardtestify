import { useEffect, useRef, useState } from "react";
import { tr } from "@boardtestify/i18n";
import { fullPhoto, uprightPhoto } from "./ocr-image";
export function PhotoSelection({ file, rotation, crop, onChange, disabled }) {
  const canvasRef = useRef(null),
    anchor = useRef(null),
    mouseAnchor = useRef(null),
    selectionRef = useRef(null);
  const [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    anchor.current = null;
    uprightPhoto(file, rotation, 1200)
      .then((image) => {
        if (!active) return;
        const canvas = canvasRef.current;
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext("2d").drawImage(image, 0, 0);
        setReady(true);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [file, rotation]);
  function point(e) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return null;
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }
  function applySelection(a, p) {
    if (!a || !p) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width < 1 || rect.height < 1) return;
    const dx = Math.abs(a.x - p.x);
    const dy = Math.abs(a.y - p.y);
    if (Math.hypot(dx, dy) < 0.015) return;
    const next = {
      x: Math.min(a.x, p.x),
      y: Math.min(a.y, p.y),
      width: Math.max(0.01, dx),
      height: Math.max(0.01, dy),
    };
    selectionRef.current = next;
    onChange({ crop: next });
  }
  function move(e) {
    if (!anchor.current || disabled) return;
    applySelection(anchor.current, point(e));
  }
  return (
    <>
      <p className="small muted">
        {tr(
          "Drag over one question column to select it. Rotate sideways photos before selecting.",
        )}
      </p>
      {error && <p role="alert">{tr(error)}</p>}
      <div
        role="group"
        aria-label={tr("Photo crop preview")}
        aria-busy={!ready}
        data-selection-width={crop.width}
        style={{
          position: "relative",
          maxWidth: 700,
          lineHeight: 0,
          touchAction: "none",
          userSelect: "none",
          cursor: disabled ? "wait" : "crosshair",
        }}
        onPointerDown={(e) => {
          if (disabled || !ready || (e.pointerType === "mouse" && e.button !== 0)) return;
          const start = point(e);
          if (!start) return;
          anchor.current = start;
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
          e.preventDefault();
        }}
        onPointerMove={move}
        onPointerUp={(e) => {
          if (anchor.current && !disabled)
            applySelection(anchor.current, point(e));
          anchor.current = null;
          try { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
        }}
        onPointerCancel={(e) => {
          anchor.current = null;
          try { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
        }}
        onMouseDown={(e) => {
          if (disabled || !ready || e.button !== 0) return;
          mouseAnchor.current = point(e);
          e.preventDefault();
        }}
        onMouseMove={(e) => {
          if (mouseAnchor.current && !disabled)
            applySelection(mouseAnchor.current, point(e));
        }}
        onMouseUp={(e) => {
          if (mouseAnchor.current && !disabled)
            applySelection(mouseAnchor.current, point(e));
          mouseAnchor.current = null;
        }}
        onMouseLeave={() => {
          // Keep the active mouse drag until mouseup so a selection can finish outside the preview.
        }}
      >
        <canvas ref={canvasRef} style={{ width: "100%", display: "block" }} />
        {ready && (
          <div
            style={{
              position: "absolute",
              pointerEvents: "none",
              border: "3px solid #ff7a00",
              background: "rgba(255,122,0,.08)",
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.width * 100}%`,
              height: `${crop.height * 100}%`,
              boxSizing: "border-box",
            }}
          />
        )}
      </div>
      <div className="row" style={{ flexWrap: "wrap", marginTop: 12 }}>
        <button
          className="button subtle"
          disabled={disabled}
          onClick={() =>
            onChange({ rotation: (rotation + 270) % 360, crop: fullPhoto })
          }
        >
          {tr("Rotate left")}
        </button>
        <button
          className="button subtle"
          disabled={disabled}
          onClick={() =>
            onChange({ rotation: (rotation + 90) % 360, crop: fullPhoto })
          }
        >
          {tr("Rotate right")}
        </button>
        <button
          className="button ghost"
          disabled={disabled}
          onClick={() => onChange({ crop: fullPhoto })}
        >
          {tr("Use full photo")}
        </button>
      </div>
    </>
  );
}
