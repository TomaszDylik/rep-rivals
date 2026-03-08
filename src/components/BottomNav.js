"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Newspaper, Users, UserCircle } from "lucide-react";

const tabs = [
  { href: "/", label: "Feed", icon: Newspaper },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-neutral-900">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 text-xs transition-colors ${
                active ? "text-lime-400" : "text-neutral-500"
              }`}
            >
              <Icon size={22} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
