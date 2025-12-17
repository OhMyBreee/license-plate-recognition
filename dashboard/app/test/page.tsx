'use client'; 

import React from 'react';
import Navbar from "@/components/navbar"
import Hero from "@/components/hero"
import DotAnimation from "@/components/dot-animation"
import { Type_writer_hero } from '@/components/type-writer-hero'
import { Button } from "@/components/ui/button"
import Link from 'next/link';
import { MousePointer2 , Github, Book } from 'lucide-react';
import Madeby from '@/components/madeby';
export default function LPRDashboard() {
  return (
    <>
    <div className="grid grid-cols-4 gap-4">
        <div className="bg-red-500">01</div>
        <div className="bg-red-500">02</div>
        <div className="bg-red-500">03</div>
        <div className="bg-red-500">09</div>
    </div>
    <div className="bg-red-500 text-3xl">TEST</div>
    </>

  );
}