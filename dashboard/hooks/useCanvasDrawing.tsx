// /src/hooks/useCanvasDrawing.ts
"use client";

import { useCallback } from "react";
import type { PlateResult } from "@/types/lpr";

/**
 * drawMultiPlateResults
 *
 * - canvas: overlay canvas
 * - imageEl: HTMLImageElement (upload) OR HTMLVideoElement (live)
 * - plates: backend detection results
 *
 * Assumptions:
 * - plate_box coords are ABSOLUTE pixel coords in model input space
 * - char_boxes coords are RELATIVE to plate crop
 */
export function useCanvasDrawing() {
  const drawMultiPlateResults = useCallback(
    (
      canvas: HTMLCanvasElement | null,
      imageEl: HTMLImageElement | HTMLVideoElement | null,
      plates: PlateResult[] | null
    ) => {
      if (!canvas || !imageEl || !plates || plates.length === 0) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const container = canvas.parentElement;
      if (!container) return;

      // Container size (aspect-video box)
      const cw = container.clientWidth;
      const ch = container.clientHeight;

      canvas.width = cw;
      canvas.height = ch;
      ctx.clearRect(0, 0, cw, ch);

      // Source size
      const srcW =
        imageEl instanceof HTMLImageElement
          ? imageEl.naturalWidth
          : imageEl.videoWidth;

      const srcH =
        imageEl instanceof HTMLImageElement
          ? imageEl.naturalHeight
          : imageEl.videoHeight;

      if (!srcW || !srcH) return;

      // Scale preserving aspect ratio (object-contain)
      const scale = Math.min(cw / srcW, ch / srcH);

      const drawW = srcW * scale;
      const drawH = srcH * scale;

      // Letterbox offset
      const offsetX = (cw - drawW) / 2;
      const offsetY = (ch - drawH) / 2;

      plates.forEach((plate, idx) => {
        const pb = plate.plate_box;
        if (!pb) return;

        const x = offsetX + pb.x_min * scale;
        const y = offsetY + pb.y_min * scale;
        const w = (pb.x_max - pb.x_min) * scale;
        const h = (pb.y_max - pb.y_min) * scale;

        // Plate box
        ctx.strokeStyle = "#e9e9e9ff";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);

        // Label
        ctx.fillStyle = "#00FF88";
        ctx.font = "14px Arial";
        ctx.fillText(
          `${idx + 1}: ${plate.plate_number ?? ""}`,
          x,
          y - 6
        );

        // Characters
        ctx.strokeStyle = "#c0c0c0ff";
        ctx.lineWidth = 1.5;

        plate.char_boxes?.forEach((cb) => {
          const cx = offsetX + (pb.x_min + cb.x_min) * scale;
          const cy = offsetY + (pb.y_min + cb.y_min) * scale;
          const cw = (cb.x_max - cb.x_min) * scale;
          const ch = (cb.y_max - cb.y_min) * scale;

          ctx.strokeRect(cx, cy, cw, ch);
        });
      });
    },
    []
  );

  return { drawMultiPlateResults };
}
