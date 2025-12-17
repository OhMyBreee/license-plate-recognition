// app/(dashboard)/LPRDashboard/page.tsx
"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Camera,
  Upload,
  Clock,
  Car,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import Navbar from "@/components/navbar";
import DotAnimation from "@/components/dot-animation"
import { useImageUpload } from "@/hooks/useImageUpload";
import { useLPRBackend } from "@/hooks/useLPRBackend";
import { useCanvasDrawing } from "@/hooks/useCanvasDrawing";
import { useSupabaseDetections } from "@/hooks/useSupabaseDetections";
import { Button } from "@/components/ui/button";

import type { DetectedPlateState, PlateResult } from "@/types/lpr";

const formatTime = (isoString: string) => {
  const now = new Date();
  const date = new Date(isoString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds} secs ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return date.toLocaleDateString();
};

export default function LPRDashboard() {
  const [activeTab, setActiveTab] = useState<"upload" | "live">("upload");
  const [mounted, setMounted] = useState(false);

  // hooks
  const { imageFile, imageURL, handleFileChange, clear: clearImage } = useImageUpload();
  const { loading: lprLoading, error: lprError, response, recognize, setResponse } = useLPRBackend();
  const { drawMultiPlateResults } = useCanvasDrawing();
  const { recentDetections, totalCount, fetchDetectionData } = useSupabaseDetections();

  // refs
  const uploadedImageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);


  // Clear response when switching tabs to avoid "ghost" boxes
  useEffect(() => {
    setResponse(null);
    setHasRunRecognition(false);
  }, [activeTab, setResponse]);

  useEffect(() => {
  // new image = old predictions invalid
  setResponse(null);
  setHasRunRecognition(false);
  setSelectedPlateIndex(0);
  }, [imageFile]);

  // UI-level selection of which plate to show as "primary"
  const [selectedPlateIndex, setSelectedPlateIndex] = useState<number>(0);
  const [hasRunRecognition, setHasRunRecognition] = useState(false);


  // When mounted (hydration) — for SSR-safe counts
  useEffect(() => {
    setMounted(true);
    fetchDetectionData();
      }, [fetchDetectionData]);

      // draw when response changes or image size changes
      const waitForVideoReady = (video: HTMLVideoElement) =>
      new Promise<void>((resolve) => {
        if (video.videoWidth > 0) resolve();
        else {
          video.onloadedmetadata = () => resolve();
        }
      });
      useEffect(() => {
      const draw = async () => {
        if (!response || !canvasRef.current) return;

        if (activeTab === "upload") {
          if (!uploadedImageRef.current) return;

          drawMultiPlateResults(
            canvasRef.current,
            uploadedImageRef.current,
            response.plates
          );
        }

        if (activeTab === "live") {
          if (!videoRef.current) return;

          await waitForVideoReady(videoRef.current); // ✅ allowed here

          drawMultiPlateResults(
            canvasRef.current,
            videoRef.current,
            response.plates
          );
        }
      };

      draw();
    }, [response, activeTab, drawMultiPlateResults]);


  const dynamicStats = useMemo(() => {
    if (recentDetections.length === 0) {
      return {
        avgConfidence: 0,
        platesDetected: 0,
      };
    }

    const successful = recentDetections.filter(
      (d) => d.status === "success"
    );

    const platesDetected = recentDetections.filter((d) => d.status === "success").length;

    const avgConfidence =
      successful.length > 0
        ? successful.reduce(
            (sum, d) => sum + (Number(d.confidence) || 0),
            0
          ) / successful.length
        : 0;

    return {
      avgConfidence: Number(avgConfidence.toFixed(1)),
      platesDetected,
    };
  }, [recentDetections]);


  // map backend response to UI state for saving or display
  // const mapPlateToDetectedState = (plate: PlateResult): DetectedPlateState => {
  //   const status = plate.plate_number === "Plate Not Found" || plate.plate_number.length === 0 ? "error" : "allowed";
  //   return {
  //     plate: plate.plate_number,
  //     confidence: Math.round((plate.confidence ?? 90)), // backend may include confidence; otherwise random-ish
  //     status,
  //     time_taken_ms: response?.time_taken_ms,
  //     plate_box: plate.plate_box ?? undefined,
  //     char_boxes: plate.char_boxes ?? undefined,
  //   };
  // };

  const { saveDetection } = useSupabaseDetections();
  // handle upload trigger
  const handleRunRecognition = async () => {
    if (!imageFile) return;
    setHasRunRecognition(false);
    setResponse(null);
    setSelectedPlateIndex(0);

    const res = await recognize(imageFile);
    if (!res || !res.plates) {
      return
    };
    setResponse(res);
    setHasRunRecognition(true);
    setSelectedPlateIndex(0);


    // Save all detected plates to Supabase
    for (const plate of res.plates) {
      await saveDetection({
        plate_number: plate.plate_number,
        confidence: (plate.plate_confidence ?? 0) * 100,
        status:
          !plate.plate_number || plate.plate_number === "Plate Not Found"
            ? "error"
            : "success",
        time_ms: res.time_taken_ms ? Number(res.time_taken_ms.toFixed(2)) : 0,
      });
    }

    await fetchDetectionData();
  };

  const handleResetUpload = () => {
    clearImage();
    setSelectedPlateIndex(0);
  };

  const captureAndRecognize = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    if (video.videoWidth === 0) return;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;

    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    tempCanvas.toBlob(async (blob) => {
    if (!blob) return;

    const file = new File([blob], "live.jpg", { type: "image/jpeg" });
    const res = await recognize(file);

    if (res) {
      setResponse(res); // 🔥 REQUIRED
    }
  }, "image/jpeg");

  };

  const startCamera = async () => {
    try {
      if (streamRef.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // Recognize every 500ms
      intervalRef.current = setInterval(captureAndRecognize, 500);
    } catch (err) {
      console.error("Camera error:", err);
    }
  };

  const stopCamera = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (activeTab === "live") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab]);

  return (
    <div className="bg-background text-white min-h-screen">
      <header className="lg:px-16 py-4 w-full backdrop-blur-sm top-0 z-10 sticky">
        <Navbar />
      </header>
      <div className="w-full p-4 flex flex-col sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="p-4 backdrop-blur-sm border rounded-xl mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-4">
            <div className="flex items-center justify-center space-x-4">
                <CheckCircle className="w-10 h-10 flex-shrink-0 text-foreground" />
                <div>
                  <p className="text-foreground text-sm">Avg Confidence</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {mounted ? dynamicStats.avgConfidence : 0}%
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-center space-x-4">
                <Car className="w-10 h-10  flex-shrink-0 text-foreground"  />
                <div>
                  <p className="text-foreground text-sm">Plates Detected</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {mounted ? dynamicStats.platesDetected : 0}
                  </p>
                </div>
              </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* left */}
          <div className="lg:col-span-2">
            <div className="bg-background backdrop-blur-sm border border-gray-700 rounded-xl overflow-hidden">
              <div className="flex border-b border-gray-500">
                <button
                  onClick={() => setActiveTab("live")}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === "live" ? "bg-background text-white border-b-2 border-blue-500" : "text-slate-400 hover:text-white hover:bg-slate-700/30"
                    }`}
                >
                  <Camera className="w-4 h-4 inline mr-2" />
                  Live Camera (Mock)
                </button>

                <button
                  onClick={() => setActiveTab("upload")}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === "upload" ? "bg-background text-white border-b-2 border-blue-500" : "text-slate-400 hover:text-white hover:bg-slate-700/30"
                    }`}
                >
                  <Upload className="w-4 h-4 inline mr-2" />
                  Upload Image
                </button>
              </div>

              <div className="p-6">
                {activeTab === "live" ? (
                  <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden border border-slate-700 aspect-video p-2">
                    <video ref={videoRef} className="w-full h-full object-contain" muted playsInline autoPlay/>
                    <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
                    <div className="absolute top-4 right-4 bg-red-500 text-white px-2 py-1 text-xs rounded animate-pulse">
                      LIVE
                    </div>
                  </div>
                ) : (
                  <div>
                    {!imageURL ? (
                      <label className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-600 hover:border-blue-500 transition-colors cursor-pointer">
                        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        <div className="text-center">
                          <Upload className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                          <p className="text-slate-400 text-lg mb-2">Upload an image</p>
                          <p className="text-slate-500 text-sm">Click to browse or drag and drop</p>
                        </div>
                      </label>
                    ) : (
                      <div className="space-y-4">
                        <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden relative border border-slate-700">
                          <img
                            ref={uploadedImageRef}
                            src={imageURL}
                            alt="Uploaded"
                            className="w-full h-full object-contain"
                          />

                          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />

                          <div className="absolute top-4 right-4 flex space-x-2">
                            <button onClick={handleResetUpload} className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full">
                              <Trash2 className="w-5 h-5" />
                            </button>
                            <label className="bg-blue-500/80 hover:bg-blue-600 text-white p-2 rounded-full cursor-pointer">
                              <Upload className="w-5 h-5" />
                              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                            </label>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <button
                            className="px-4 py-2 bg-blue-500 rounded text-white"
                            onClick={handleRunRecognition}
                            disabled={lprLoading}
                          >
                            {lprLoading ? "Processing..." : "Recognize Plates"}
                          </button>

                          <button className="px-4 py-2 bg-gray-700 rounded text-white" onClick={handleResetUpload}>
                            Reset
                          </button>
                        </div>

                        {/* detection results panel: show list of plates and selected plate details */}
                        <div className="bg-gray-900 rounded-lg p-4 border border-gray-600">
                          {lprError && <div className="text-red-400">{lprError}</div>}

                          {!hasRunRecognition && !lprLoading && <p className="text-slate-400">No detection yet. Upload and run recognition.</p>}

                          {hasRunRecognition && response && response.plates.length === 0 && <p className="text-orange-400">No plates found.</p>}

                          {response && response.plates.length > 0 && (
                            <div className="space-y-4">
                              <div className="flex gap-2 overflow-x-auto">
                                {response.plates.map((p, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => setSelectedPlateIndex(idx)}
                                    className={`px-3 py-2 rounded ${selectedPlateIndex === idx ? "bg-blue-600" : "bg-slate-800/40"} text-sm`}
                                  >
                                    {idx + 1}: {p.plate_number || "unknown"}
                                  </button>
                                ))}
                              </div>

                              {/* show primary selected plate */}
                              <div>
                                <h3 className="text-lg font-semibold">Selected plate</h3>
                                <div className="mt-2">
                                  {(() => {
                                    const p = response.plates[selectedPlateIndex];
                                    if (!p) return <div className="text-slate-400">No plate selected</div>;
                                    const status = p.plate_number === "Plate Not Found" || p.plate_number.length === 0 ? "error" : "allowed";
                                    return (
                                      <div className="space-y-3">
                                        <div className="flex items-center space-x-2">
                                          {status === "error" ? <XCircle className="w-5 h-5 text-red-400" /> : <CheckCircle className="w-5 h-5 text-green-400" />}
                                          <span className={`text-lg font-bold ${status === "error" ? "text-red-400" : "text-green-400"}`}>{status === "error" ? "Detection Failed" : "Detection Complete"}</span>
                                        </div>

                                        <div className="p-4 rounded-lg font-mono text-center bg-slate-800/50 border border-slate-700">
                                          <p className="text-3xl font-extrabold tracking-widest">{p.plate_number}</p>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                          <div>
                                            <p className="text-slate-400 text-sm">Time Taken</p>
                                            <p className="text-white text-xl font-bold mt-1">{response.time_taken_ms?.toFixed(2) ?? "N/A"} ms</p>
                                          </div>
                                          <div>
                                            <p className="text-slate-400 text-sm">Chars Detected</p>
                                            <p className="text-white text-xl font-bold mt-1">{p.char_boxes?.length ?? 0}</p>
                                          </div>
                                          <div>
                                            <p className="text-slate-400 text-sm">Confidence</p>
                                            <p className="text-white text-xl font-bold mt-1">
                                              {p.plate_confidence ? Math.round(p.plate_confidence * 100) : "N/A"}%
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* right */}
          <div className="lg:col-span-1">
            <Card className="bg-background border-2 border-gray-900 backdrop-blur-sm ">
              {/* Header */}
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-xl font-bold text-white">
                  Recent Detections
                </CardTitle>
                <Button
                  onClick={fetchDetectionData}
                  variant="ghost"
                  className="text-sm text-blue-500"
                >
                  Refresh
                </Button>
              </CardHeader>

              {/* Scrollable content */}
              <CardContent className="max-h-[300px] overflow-y-auto space-y-4 pr-2">
                {recentDetections.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">
                    No recent detections found.
                  </p>
                ) : (
                  recentDetections.map((d: any) => (
                    <Card
                      key={d.id}
                      className="bg-slate-900/50 border-slate-700 hover:border-slate-600 transition-colors"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-mono font-bold text-lg">
                            {d.plate_number}
                          </span>
                          {d.status === "success" ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-400" />
                          )}
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">
                            {formatTime(d.created_at)}
                          </span>
                          <span className="text-blue-400">
                            {Math.round(d.confidence)}% confidence
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
