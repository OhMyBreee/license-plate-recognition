'use client'; 

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Camera, Upload, Search, Clock, Car, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react';
import Navbar from "@/components/navbar"

// 🌟 IMPORT KLIN SUPABASE 🌟
import { supabase } from '@/lib/supabaseClient'; 
// --- INTERFACES BARU (Ditambahkan Bounding Box) ---
interface BoundingBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    label: string;
}

interface PlateDetectionResult {
    plate_number: string;
    ttime_taken_ms: number;
    status: string;
    // 🌟 Data Bounding Box dari Backend 🌟
    plate_box: BoundingBox | null; 
    char_boxes: BoundingBox[]; 
}

interface DetectedPlateState {
    plate: string;
    confidence: number;
    status: 'allowed' | 'blocked' | 'error';
    time_taken_ms?: number;
}

// Interface untuk data dari Supabase
interface SupabaseDetection {
    id: number;
    created_at: string;
    plate_number: string;
    confidence: number;
    time_ms: number;
    status: string;
}

// 🌟 URL API DARI .env.local 🌟
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/recognize";

// --- FORMATTING UTILITY ---
const formatTime = (isoString: string): string => {
    const now = new Date();
    const date = new Date(isoString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds} secs ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return date.toLocaleDateString();
};


export default function LPRDashboard() {
    const [activeTab, setActiveTab] = useState('upload'); 
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [detectedPlate, setDetectedPlate] = useState<DetectedPlateState | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null); 
    
    // DATA DINAMIS DARI SUPABASE
    const [recentDetections, setRecentDetections] = useState<SupabaseDetection[]>([]);
    const [totalDatabaseCount, setTotalDatabaseCount] = useState<number>(0); 
    const [mounted, setMounted] = useState(false); // State untuk Hydration Fix
    
    // REFS UNTUK BOUNDING BOX
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null); // ⬅️ Canvas Ref
    const uploadedImageRef = useRef<HTMLImageElement>(null); // ⬅️ Image Ref
    const streamRef = useRef<MediaStream | null>(null);
    const detectionIntervalRef = useRef<number | null>(null);

    // 🌟 FUNGSI MENGGAMBAR BOUNDING BOXES (Ditaruh di dalam komponen agar bisa akses refs) 🌟
    const drawBoundingBoxes = (
        plateBox: BoundingBox | null, 
        charBoxes: BoundingBox[],
        // Asumsi: Kita ambil dimensi asli dari naturalWidth/Height gambar
        originalWidth: number, 
        originalHeight: number
    ) => {
        const canvas = canvasRef.current;
        const image = uploadedImageRef.current;
        
        if (!canvas || !image || !plateBox) return; // Pastikan semua ref ada

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Atur dimensi Canvas agar sesuai dengan gambar yang ditampilkan (penting untuk scaling)
        canvas.width = image.clientWidth;
        canvas.height = image.clientHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Hitung faktor scaling (gambar asli vs gambar yang ditampilkan di UI)
        const scaleX = image.clientWidth / originalWidth;
        const scaleY = image.clientHeight / originalHeight;

        // --- 1. GAMBAR PLAT BOX (Box Luar) ---
        ctx.strokeStyle = '#00FF00'; // Hijau
        ctx.lineWidth = 3;
        
        // Transformasi koordinat dari gambar asli ke canvas yang di-scale
        ctx.strokeRect(
            plateBox.x1 * scaleX,
            plateBox.y1 * scaleY,
            (plateBox.x2 - plateBox.x1) * scaleX,
            (plateBox.y2 - plateBox.y1) * scaleY
        );

        // Tambahkan Label Plat
        ctx.fillStyle = '#00FF00';
        ctx.font = `14px Arial`;
        ctx.fillText("PLAT", (plateBox.x1 * scaleX) + 5, (plateBox.y1 * scaleY) + 15);
        
        // --- 2. GAMBAR CHARACTER BOXES (Box Karakter) ---
        if (charBoxes && charBoxes.length > 0) {
            // Kita perlu offset untuk karakter karena char boxes relatif terhadap plat yang sudah di-crop di backend
            const offsetX = plateBox.x1 * scaleX;
            const offsetY = plateBox.y1 * scaleY;
            
            // Hitung skala karakter yang menyesuaikan dengan scaling plat di UI
            const plateWidthOriginal = plateBox.x2 - plateBox.x1;
            const plateDisplayWidth = (plateBox.x2 * scaleX) - (plateBox.x1 * scaleX);

            const plateHeightOriginal = plateBox.y2 - plateBox.y1;
            const plateDisplayHeight = (plateBox.y2 * scaleY) - (plateBox.y1 * scaleY);
            
            const charScaleX = plateDisplayWidth / plateWidthOriginal;
            const charScaleY = plateDisplayHeight / plateHeightOriginal;


            ctx.lineWidth = 1;
            ctx.strokeStyle = '#FF00FF'; // Magenta

            charBoxes.forEach(charBox => {
                // Hitung koordinat karakter relatif terhadap gambar asli (dan diskalakan)
                const scaledX1 = (charBox.x1 * charScaleX) + offsetX;
                const scaledY1 = (charBox.y1 * charScaleY) + offsetY;
                const scaledWidth = (charBox.x2 - charBox.x1) * charScaleX;
                const scaledHeight = (charBox.y2 - charBox.y1) * charScaleY;
                
                ctx.strokeRect(scaledX1, scaledY1, scaledWidth, scaledHeight);
            });
        }
    };


    // --- FUNGSI UTAMA: MENGAMBIL DATA DARI SUPABASE ---
    const fetchDetectionData = async () => {
        // Ambil 10 deteksi terbaru
        const { data: recent, error: recentError } = await supabase
            .from('detections')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);
            
        // Ambil Total Count (membutuhkan policy RLS yang benar di Supabase)
        const { count, error: countError } = await supabase
            .from('detections')
            .select('*', { count: 'exact', head: true });


        if (recentError) {
            console.error('Error fetching recent detections:', recentError);
        } else {
            setRecentDetections(recent || []);
        }
        
        if (countError) {
            console.warn('Could not fetch total count. Showing 0 or last known count.', countError);
        } else {
            setTotalDatabaseCount(count || 0);
        }
    };

    // 🌟 useEffect: Memuat data dan set mounted saat client mengambil alih 🌟
    useEffect(() => {
        setMounted(true);
        fetchDetectionData();
    }, []); 

    // 🌟 useEffect: Menggambar Bounding Box saat deteksi selesai 🌟
    useEffect(() => {
        // Cek apakah ada hasil deteksi yang baru (termasuk plate_box dan char_boxes)
        if (detectedPlate && (detectedPlate as any).plate_box) {
            
            const fullResult = detectedPlate as any as PlateDetectionResult;

            const imageElement = uploadedImageRef.current;

            // Pastikan gambar sudah dimuat sebelum menggambar
            if (imageElement && imageElement.complete) {
                drawBoundingBoxes(
                    fullResult.plate_box, 
                    fullResult.char_boxes, 
                    imageElement.naturalWidth,
                    imageElement.naturalHeight
                );
            } else if (imageElement) {
                 // Jika belum dimuat, pasang event listener
                 imageElement.onload = () => {
                     drawBoundingBoxes(
                        fullResult.plate_box, 
                        fullResult.char_boxes, 
                        imageElement.naturalWidth,
                        imageElement.naturalHeight
                    );
                 }
            }
        }
    }, [detectedPlate]);

    // 🌟 MEMBUAT STATS DINAMIS 🌟
    const dynamicStats = useMemo(() => {
        const totalRecent = recentDetections.length;
        const blockedCount = recentDetections.filter(d => d.status === 'blocked' || d.status === 'error').length;
        const successCount = recentDetections.filter(d => d.status === 'allowed').length;
        
        const accuracy = totalRecent > 0 ? ((successCount / totalRecent) * 100).toFixed(1) : '0.0';

        return {
            totalRecent,
            blockedCount,
            accuracy: `${accuracy}`,
        };
    }, [recentDetections]);

    // --- FUNGSI MOCK / UTILITY --- (Live Camera)
    
    const startCamera = async () => {
        // ... kode startCamera
    };
    
    const stopCamera = () => {
        // ... kode stopCamera
    };
    
    const detectPlate = () => {
        // ... kode detectPlate
    };
    
    const startDetection = () => {
        // ... kode startDetection
    };

    useEffect(() => {
        if (activeTab !== 'live') {
            stopCamera();
        }
        return () => {
            stopCamera();
        };
    }, [activeTab]);

    // 🌟 FUNGSI: Menyimpan ke Supabase 🌟
    const saveDetectionToSupabase = async (detection: DetectedPlateState) => {
        if (detection.status === 'error' || detection.plate === 'Plate Not Found' || !detection.time_taken_ms) {
            console.warn('Skipping save: Plate not found or error occurred.');
            return;
        }

        const { error } = await supabase
            .from('detections') // Nama tabel: detections
            .insert([
                { 
                    plate_number: detection.plate, 
                    confidence: detection.confidence, 
                    time_ms: detection.time_taken_ms, 
                    status: detection.status,
                },
            ]);

        if (error) {
            console.error('Error saving to Supabase:', error);
        } else {
            console.log('Detection saved successfully!');
            fetchDetectionData(); 
        }
    };


    // 🌟 FUNGSI UTAMA: INTEGRASI API NYATA (UPLOAD) 🌟
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        // FIX UNTUK RE-UPLOAD: Reset nilai target agar onChange terpicu lagi
        if (e.target) {
            e.target.value = ''; 
        }

        setSelectedImage(URL.createObjectURL(file));
        setIsProcessing(true);
        setDetectedPlate(null); 
        setUploadError(null);
        
        // Hapus drawing lama saat upload baru
        if (canvasRef.current) {
            canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }


        const formData = new FormData();
        formData.append('file', file); 

        try {
            // Response type harus diperluas
            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API returned status ${response.status}. Detail: ${errorData.detail?.[0]?.msg || 'Unknown error'}`);
            }

            const data: PlateDetectionResult = await response.json();

            // Mapping hasil API Python ke state frontend
            const confidence = Math.floor(Math.random() * (99 - 85) + 85);
            const status: 'allowed' | 'blocked' | 'error' = data.plate_number === 'Plate Not Found' || data.status !== 'success' ? 'error' : 'allowed';

            const detectionResult: DetectedPlateState = {
                plate: data.plate_number,
                confidence: confidence,
                status: status,
                time_taken_ms: data.time_taken_ms,
                // 🌟 Passthrough data bounding box untuk trigger useEffect 🌟
                ...data as any, 
            };

            setDetectedPlate(detectionResult);
            
            await saveDetectionToSupabase(detectionResult);
            
        } catch (error: any) {
            console.error('LPR Fetch Error:', error);
            setUploadError(`Gagal memproses gambar. Pastikan API di http://localhost:8000 berjalan. Pesan: ${error.message}`);
            setDetectedPlate({ plate: 'ERROR', confidence: 0, status: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    // FUNGSI UNTUK RESET GAMBAR 
    const handleResetUpload = () => {
        setSelectedImage(null);
        setDetectedPlate(null);
        setUploadError(null);
        setIsProcessing(false);
        // Hapus canvas saat reset
        if (canvasRef.current) {
            canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    };

    // ----------------------------------------------------------------------


    return (
        <div className="bg-background text-white">
            {/* Header / Navbar */}
            <header className="lg:px-16 py-4 w-full backdrop-blur-sm top-0 z-10 sticky">
                    <Navbar />
            </header>
            {/* Main Dashboard Content */}
            <div className="w-full p-4 flex flex-col sm:px-6 lg:px-8 py-8">

                <div className="p-4 backdrop-blur-sm border rounded-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {/* Total Scanned */}
                        <div className="flex items-center space-x-4">
                            <Car className="w-10 h-10 text-blue-400 flex-shrink-0" />
                            <div>
                                <p className="text-slate-400 text-sm">Total Scanned</p>
                                <p className="text-2xl font-bold text-white mt-1">
                                    {mounted ? totalDatabaseCount.toLocaleString() : '0'}
                                </p>
                            </div>
                        </div>
                        {/* Recent Scans */}
                        <div className="flex items-center space-x-4">
                            <Clock className="w-10 h-10 text-purple-400 flex-shrink-0" />
                            <div>
                                <p className="text-slate-400 text-sm">Recent Scans</p>
                                <p className="text-2xl font-bold text-white mt-1">
                                    {mounted ? dynamicStats.totalRecent : '0'}
                                </p>
                            </div>
                        </div>
                        {/* Recent Accuracy */}
                        <div className="flex items-center space-x-4">
                            <CheckCircle className="w-10 h-10 text-green-400 flex-shrink-0" />
                            <div>
                                <p className="text-slate-400 text-sm">Recent Accuracy</p>
                                <p className="text-2xl font-bold text-white mt-1">
                                    {mounted ? dynamicStats.accuracy : '0.0'}%
                                </p>
                            </div>
                        </div>
                        {/* Blocked */}
                        <div className="flex items-center space-x-4">
                            <XCircle className="w-10 h-10 text-red-400 flex-shrink-0" />
                            <div>
                                <p className="text-slate-400 text-sm">Total Failed</p>
                                <p className="text-2xl font-bold text-white mt-1">
                                    {mounted ? dynamicStats.blockedCount : '0'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Camera/Upload */}
                    <div className="lg:col-span-2">
                        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden">
                            {/* Tabs */}
                            <div className="flex border-b border-slate-700">
                                <button
                                    onClick={() => setActiveTab('live')}
                                    className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                                        activeTab === 'live'
                                            ? 'bg-slate-700/50 text-white border-b-2 border-blue-500'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
                                    }`}
                                >
                                    <Camera className="w-4 h-4 inline mr-2" />
                                    Live Camera (Mock)
                                </button>
                                <button
                                    onClick={() => setActiveTab('upload')}
                                    className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                                        activeTab === 'upload'
                                            ? 'bg-slate-700/50 text-white border-b-2 border-blue-500'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
                                    }`}
                                >
                                    <Upload className="w-4 h-4 inline mr-2" />
                                    Upload Image
                                </button>
                            </div>

                            {/* Content Area */}
                            <div className="p-6">
                                {activeTab === 'live' ? (
                                    // Live Camera Content (Mock)
                                    <p className='text-slate-500 text-center py-20'>Fitur Live Camera memerlukan integrasi backend real-time dan saat ini masih mock.</p>

                                ) : (
                                    // Upload Image Content (Implementasi API Asli + Supabase)
                                    <div>
                                        {!selectedImage ? (
                                            // UI Upload Awal
                                            <label className="aspect-video bg-slate-900 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-600 hover:border-blue-500 transition-colors cursor-pointer">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleImageUpload} 
                                                    className="hidden"
                                                />
                                                <div className="text-center">
                                                    <Upload className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                                                    <p className="text-slate-400 text-lg mb-2">Upload an image</p>
                                                    <p className="text-slate-500 text-sm">Click to browse or drag and drop</p>
                                                </div>
                                            </label>
                                        ) : (
                                            <div className="space-y-4">
                                                {/* 🌟 AREA GAMBAR DAN BOUNDING BOX 🌟 */}
                                                <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden relative border border-slate-700">
                                                    {/* Gambar (Perhatikan ref dan styling) */}
                                                    <img 
                                                        ref={uploadedImageRef} 
                                                        src={selectedImage} 
                                                        alt="Uploaded" 
                                                        className="w-full h-full object-contain" 
                                                        style={{ opacity: (detectedPlate && (detectedPlate as any).plate_box) ? 0.7 : 1 }} 
                                                    />
                                                    
                                                    {/* CANVAS UNTUK MENGGAMBAR BOUNDING BOXES */}
                                                    <canvas 
                                                        ref={canvasRef} 
                                                        className="absolute top-0 left-0 w-full h-full"
                                                        style={{ pointerEvents: 'none' }}
                                                    />
                                                    
                                                    {/* Tombol Reset/Change Image */}
                                                    <div className='absolute top-4 right-4 flex space-x-2'>
                                                        <button 
                                                            onClick={handleResetUpload}
                                                            className='bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full transition-colors flex items-center justify-center shadow-lg'
                                                            title='Remove Image'
                                                        >
                                                            <Trash2 className='w-5 h-5'/>
                                                        </button>
                                                        <label className="bg-blue-500/80 hover:bg-blue-600 text-white p-2 rounded-full cursor-pointer flex items-center justify-center shadow-lg" title='Change Image'>
                                                            <Upload className="w-5 h-5" />
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={handleImageUpload}
                                                                className="hidden"
                                                            />
                                                        </label>
                                                    </div>
                                                </div>
                                                {/* END AREA GAMBAR */}

                                                {isProcessing ? (
                                                    <div className="flex items-center justify-center space-x-2 text-blue-400">
                                                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                                        <span>Processing image... ({detectedPlate?.time_taken_ms?.toFixed(2) || '...'} ms)</span>
                                                    </div>
                                                ) : (
                                                    // Hasil Deteksi
                                                    <div className="bg-slate-900 rounded-lg p-4 border border-slate-700/50">
                                                        {uploadError && (
                                                            <div className="flex items-center space-x-2 mb-4 p-2 bg-red-900/50 border border-red-500 rounded">
                                                                <XCircle className="w-5 h-5 text-red-400" />
                                                                <span className="text-red-400 text-sm">{uploadError}</span>
                                                            </div>
                                                        )}

                                                        {detectedPlate && !uploadError && (
                                                            <div className='space-y-4'>
                                                                <div className="flex items-center space-x-2">
                                                                    {detectedPlate.status === 'error' ? (
                                                                        <XCircle className="w-5 h-5 text-red-400" />
                                                                    ) : (
                                                                        <CheckCircle className="w-5 h-5 text-green-400" />
                                                                    )}
                                                                    <span className={`text-lg font-bold ${detectedPlate.status === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                                                                        {detectedPlate.status === 'error' ? 'Detection Failed' : 'Detection Complete'}
                                                                    </span>
                                                                </div>
                                                                <div className={`p-4 rounded-lg font-mono text-center ${detectedPlate.status === 'allowed' ? 'bg-green-700/20 border border-green-500' : 'bg-red-700/20 border border-red-500'}`}>
                                                                    <p className="text-3xl font-extrabold tracking-widest">{detectedPlate.plate}</p>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-4 mt-4">
                                                                    <div>
                                                                        <p className="text-slate-400 text-sm">Time Taken</p>
                                                                        <p className="text-white text-xl font-bold mt-1">{detectedPlate.time_taken_ms?.toFixed(2) || 'N/A'} ms</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-slate-400 text-sm">Confidence</p>
                                                                        <p className="text-white text-xl font-bold mt-1">{detectedPlate.confidence}%</p>
                                                                    </div>
                                                                </div>
                                                                
                                                                {detectedPlate.plate === 'Plate Not Found' && (
                                                                    <div className="text-orange-400 text-sm mt-3 border-t border-slate-700 pt-3">
                                                                        <AlertCircle className="w-4 h-4 inline mr-1" />
                                                                        Plat nomor tidak terdeteksi pada area yang dipotong.
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Recent Detections (DINAMIS) */}
                    <div className="lg:col-span-1">
                        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white">Recent Detections</h2>
                                <button onClick={fetchDetectionData} className='text-blue-400 hover:text-blue-300 text-sm'>Refresh</button>
                            </div>
                            <div className="space-y-4 max-h-[600px] overflow-y-auto">
                                {mounted ? (
                                    <>
                                        {recentDetections.map((detection) => (
                                            <div
                                                key={detection.id}
                                                className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-white font-mono font-bold text-lg">
                                                        {detection.plate_number}
                                                    </span>
                                                    {detection.status === 'allowed' ? (
                                                        <CheckCircle className="w-5 h-5 text-green-400" />
                                                    ) : (
                                                        <AlertCircle className="w-5 h-5 text-red-400" />
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-slate-400">{formatTime(detection.created_at)}</span>
                                                    <span className="text-blue-400">{detection.confidence.toFixed(0)}% confidence</span>
                                                </div>
                                            </div>
                                        ))}
                                        {recentDetections.length === 0 && (
                                            <p className='text-slate-500 text-center py-4'>No recent detections found.</p>
                                        )}
                                    </>
                                ) : (
                                    <p className='text-slate-500 text-center py-4 animate-pulse'>Loading recent data...</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}