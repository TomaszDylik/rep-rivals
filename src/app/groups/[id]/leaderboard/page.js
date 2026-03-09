"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ArrowLeft, Crown } from "lucide-react";

const TIMEFRAMES = [
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All-time" },
];

const PODIUM_STYLES = [
  { emoji: "\uD83C\uDFC6", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/30" },
  { emoji: "\uD83E\uDD48", color: "text-neutral-300", bg: "bg-neutral-300/10", border: "border-neutral-300/30" },
  { emoji: "\uD83E\uDD49", color: "text-amber-600", bg: "bg-amber-600/10", border: "border-amber-600/30" },
];

export default function LeaderboardPage() {
  const router = useRouter();
  const { id } = useParams();

  const [group, setGroup] = useState(null);
  const [entries, setEntries] = useState([]);
  const [timeframe, setTimeframe] = useState("week");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return router.push("/login");
      loadGroup();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (group) loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, group]);

  async function loadGroup() {
    const { data } = await supabase
      .from("groups")
      .select("id, name")
      .eq("id", id)
      .single();
    setGroup(data);
  }

  async function loadLeaderboard() {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(
        `/api/leaderboard?groupId=${id}&timeframe=${timeframe}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="min-h-screen bg-neutral-950 px-4 pb-24 pt-6">
      <Link
        href={`/groups/${id}`}
        className="inline-flex items-center gap-1 text-sm text-neutral-400 transition-colors hover:text-lime-400"
      >
        <ArrowLeft size={16} /> Back to group
      </Link>

      <div className="mt-4 flex items-center gap-2">
        <Crown size={22} className="text-lime-400" />
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
      </div>
      {group && (
        <p className="mt-1 text-xs text-neutral-500">{group.name}</p>
      )}

      {/* Timeframe filter */}
      <div className="mt-5 flex gap-1 rounded-2xl border border-white/5 bg-neutral-900/60 backdrop-blur-md p-1">
        {TIMEFRAMES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTimeframe(key)}
            className={`flex-1 rounded-xl py-2 text-xs font-medium transition-colors ${
              timeframe === key
                ? "bg-neutral-800/80 text-lime-400"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-12 flex items-center justify-center">
          <p className="text-neutral-400">Loading...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <p className="text-neutral-400">No workouts yet for this period.</p>
          <p className="text-sm text-neutral-600">
            Start logging workouts to see the ranking!
          </p>
        </div>
      ) : (
        <>
          {/* Podium — top 3 */}
          <div className="mt-6 space-y-3">
            {podium.map((entry, i) => {
              const style = PODIUM_STYLES[i];
              const initial = entry.username
                ? entry.username.charAt(0).toUpperCase()
                : "?";
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-3 rounded-2xl border ${style.border} ${style.bg} backdrop-blur-md p-4`}
                >
                  <span className="text-2xl">{style.emoji}</span>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-sm font-bold text-lime-400">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">
                      {entry.username || "Unknown"}
                    </p>
                    <p className={`text-xs ${style.color}`}>
                      Rank #{entry.rank}
                    </p>
                  </div>
                  <span className={`text-lg font-bold ${style.color}`}>
                    {Math.round(entry.total_points)} pts
                  </span>
                </div>
              );
            })}
          </div>

          {/* Rest of the rankings */}
          {rest.length > 0 && (
            <ul className="mt-4 space-y-2">
              {rest.map((entry) => {
                const initial = entry.username
                  ? entry.username.charAt(0).toUpperCase()
                  : "?";
                return (
                  <li
                    key={entry.user_id}
                    className="flex items-center gap-3 rounded-2xl border border-white/5 bg-neutral-900/60 backdrop-blur-md px-4 py-3"
                  >
                    <span className="w-6 text-center text-sm font-bold text-neutral-500">
                      {entry.rank}
                    </span>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-bold text-lime-400">
                      {initial}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                      {entry.username || "Unknown"}
                    </p>
                    <span className="text-sm font-bold text-lime-400">
                      {Math.round(entry.total_points)} pts
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
