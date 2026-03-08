"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

export default function FAB() {
  return (
    <Link
      href="/workouts/new"
      className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-lime-500 shadow-lg shadow-lime-500/25 transition-transform hover:scale-105 active:scale-95"
    >
      <Plus size={28} className="text-black" />
    </Link>
  );
}
