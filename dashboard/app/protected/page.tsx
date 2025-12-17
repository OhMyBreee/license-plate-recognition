'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import Navbar from "@/components/navbar"

// Waktu dalam milidetik sebelum redirect (misalnya: 2.5 detik)
const REDIRECT_DELAY_MS = 2500; 

export default function ProtectedPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(REDIRECT_DELAY_MS / 1000); // 2.5

  useEffect(() => {
    // Timer untuk redirect ke halaman utama (/)
    const timer = setTimeout(() => {
      // Redirect ke halaman utama (/)
      router.push('/');
    }, REDIRECT_DELAY_MS);

    // Interval untuk update countdown text di UI
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 0.5 : 0));
    }, 500);

    // Cleanup function: Hentikan timer dan interval jika komponen di-unmount
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [router]); // Hanya dijalankan sekali saat komponen dimuat

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      {/* Navbar di sini agar tampilan tetap konsisten */}
      <div className='lg:px-16 py-4 w-full backdrop-blur-sm top-0 z-10 sticky'>
        <Navbar></Navbar>
      </div>

      {/* Konten Sambutan */}
      <div className='flex flex-col w-full h-full flex-grow items-center justify-center p-6 text-center'>
        <CheckCircle className="w-20 h-20 text-green-500 animate-in fade-in zoom-in mb-6" />
        <h1 className="text-4xl font-bold text-white mb-3">Login Berhasil!</h1>
        <p className="text-xl text-slate-400 mb-8">
          Selamat datang kembali. Anda akan diarahkan ke halaman utama dalam {Math.max(0, countdown).toFixed(1)} detik...
        </p>
        <div 
          className="w-48 h-2 bg-slate-700 rounded-full overflow-hidden" 
          aria-label="Redirecting progress"
        >
          <div 
            className="h-full bg-blue-500 transition-all ease-linear" 
            style={{ width: `${(1 - (countdown / (REDIRECT_DELAY_MS / 1000))) * 100}%`, transitionDuration: '500ms' }}
          />
        </div>
      </div>
    </div>
  );
}