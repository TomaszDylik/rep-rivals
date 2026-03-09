"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { MessageCircle, Plus } from "lucide-react";
import Link from "next/link";

const REACTIONS = [
  { emoji: "\uD83D\uDD25", label: "fire" },
  { emoji: "\uD83D\uDCAA", label: "muscle" },
  { emoji: "\u2764\uFE0F", label: "heart" },
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function FeedPage() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return router.push("/login");
      loadFeed(user.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFeed(userId) {
    // get user's group ids
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId);

    if (!memberships || memberships.length === 0) {
      setLoading(false);
      return;
    }

    const groupIds = memberships.map((m) => m.group_id);

    const { data } = await supabase
      .from("workouts")
      .select("id, name, created_at, group_id, users(username), groups(name), exercises(custom_name, sets(points))")
      .in("group_id", groupIds)
      .order("created_at", { ascending: false })
      .limit(30);

    if (data) setWorkouts(data);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <p className="text-neutral-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-4 pb-28 pt-6">
      <h1 className="text-2xl font-bold text-white">Feed</h1>

      {workouts.length === 0 ? (
        <div className="mt-20 flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-900">
            <Plus size={28} className="text-neutral-600" />
          </div>
          <p className="text-neutral-400">No workouts yet.</p>
          <p className="text-sm text-neutral-600">
            Join a group and tap the{" "}
            <span className="font-semibold text-lime-400">+</span> button to
            log your first workout!
          </p>
          <Link
            href="/groups"
            className="mt-2 rounded-lg bg-lime-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-400"
          >
            Browse Groups
          </Link>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {workouts.map((w) => {
            const initial = w.users?.username
              ? w.users.username.charAt(0).toUpperCase()
              : "?";
            const exercises = w.exercises || [];
            const totalPts = exercises.reduce(
              (sum, ex) => sum + (ex.sets || []).reduce((s, st) => s + Number(st.points || 0), 0), 0
            );

            return (
              <li
                key={w.id}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                {/* Header: avatar + user + time + points */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-sm font-bold text-lime-400">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {w.users?.username ?? "Unknown"}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {w.groups?.name} &middot; {timeAgo(w.created_at)}
                    </p>
                  </div>
                  {totalPts > 0 && (
                    <span className="shrink-0 text-sm font-bold text-lime-400">
                      +{Math.round(totalPts)} pts
                    </span>
                  )}
                </div>

                {/* Body: workout title + exercise summary */}
                <p className="mt-3 text-sm font-semibold text-white">
                  {w.name}
                </p>
                {exercises.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {exercises.map((ex, i) => (
                      <li key={i} className="text-xs text-neutral-500">
                        &bull; {ex.custom_name}: {(ex.sets || []).length} {(ex.sets || []).length === 1 ? "set" : "sets"}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Footer: reactions + comments */}
                <div className="mt-3 flex items-center gap-1 border-t border-neutral-800 pt-3">
                  {REACTIONS.map(({ emoji, label }) => (
                    <button
                      key={label}
                      className="rounded-lg px-3 py-1.5 text-base transition-colors hover:bg-neutral-800"
                    >
                      {emoji}
                    </button>
                  ))}
                  <button className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-300">
                    <MessageCircle size={16} />
                    <span className="text-xs">Comment</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
