"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import Navbar from "@/components/navbar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWatchList } from "@/hooks/useWatchList";

export default function LPRDashboard() {
  const [newPlate, setNewPlate] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const esp32IntervalRef = useRef<NodeJS.Timeout | null>(null);

  const ESP32_BASE_URL = "http://192.168.137.1:8000";

  const { watchList, fetchWatchList, addPlate, removePlate } = useWatchList();

  useEffect(() => {
    fetchWatchList();
  }, []);

  const fetchESP32Frame = async () => {
  if (!canvasRef.current) return;

  const url = `${ESP32_BASE_URL}/latest?t=${Date.now()}`;

  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
    });

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    } catch (err) {
      console.log("Frame error", err);
    }
  };


  useEffect(() => {
    esp32IntervalRef.current = setInterval(fetchESP32Frame, 500);

    return () => {
      if (esp32IntervalRef.current) {
        clearInterval(esp32IntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-background text-white min-h-screen">
      <header className="lg:px-16 py-4 w-full backdrop-blur-sm top-0 z-10 sticky">
        <Navbar />
      </header>

      <div className="w-full p-4 flex flex-col sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT SIDE — Camera */}
          <div className="lg:col-span-2">
            <div className="bg-background backdrop-blur-sm border border-gray-700 rounded-xl overflow-hidden">
              <div className="flex border-b border-gray-500">
                <button
                  className="flex-1 px-6 py-4 text-sm font-medium bg-background text-white border-b-2 border-blue-500"
                >
                  <Camera className="w-4 h-4 inline mr-2" />
                  Live Camera
                </button>
              </div>

              <div className="p-6">
                <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden border border-slate-700 p-2">
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={480}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-4 right-4 bg-green-600 text-white px-2 py-1 text-xs rounded">
                    ESP32 LIVE
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE — Watchlist */}
          <div>
            <Card className="bg-background border-2 border-gray-900 backdrop-blur-sm w-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-xl font-bold text-white">
                  Watch List
                </CardTitle>

                <Button
                  onClick={fetchWatchList}
                  variant="ghost"
                  className="text-sm text-blue-500"
                >
                  Refresh
                </Button>
              </CardHeader>

              <div className="flex gap-2 p-4 border-t border-slate-700">
                <Input
                  placeholder="Add plate number"
                  value={newPlate}
                  onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
                  className="font-mono"
                />
                <Button
                  onClick={() => {
                    if (newPlate.trim()) {
                      addPlate(newPlate.trim());
                      setNewPlate("");
                    }
                  }}
                >
                  Add
                </Button>
              </div>

              <CardContent className="max-h-64 overflow-y-auto divide-y divide-slate-700">
                {watchList.length === 0 ? (
                  <p className="text-slate-500 text-sm p-4">
                    No plates in watchlist
                  </p>
                ) : (
                  watchList.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-3 px-1"
                    >
                      <span className="font-mono text-md">{p.plate_number}</span>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:text-red-600"
                        onClick={() => removePlate(p.plate_number)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
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
