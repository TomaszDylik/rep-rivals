"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { MessageCircle, Plus, Send } from "lucide-react";
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
  const [userId, setUserId] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openComments, setOpenComments] = useState({});
  const [commentTexts, setCommentTexts] = useState({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return router.push("/login");
      setUserId(user.id);
      loadFeed(user.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFeed(uid) {
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", uid);

    if (!memberships || memberships.length === 0) {
      setLoading(false);
      return;
    }

    const groupIds = memberships.map((m) => m.group_id);

    const { data } = await supabase
      .from("workouts")
      .select(
        "id, name, created_at, group_id, users(username), groups(name), exercises(custom_name, sets(points)), reactions(id, user_id, type), comments(id, content, created_at, user_id, users(username))"
      )
      .in("group_id", groupIds)
      .order("created_at", { ascending: false })
      .limit(30);

    if (data) setWorkouts(data);
    setLoading(false);
  }

  async function handleReaction(workoutId, reactionLabel) {
    if (!userId) return;
    const workout = workouts.find((w) => w.id === workoutId);
    if (!workout) return;

    const existing = (workout.reactions || []).find(
      (r) => r.user_id === userId
    );

    if (existing && existing.type === reactionLabel) {
      // same reaction — remove it (toggle off)
      await supabase.from("reactions").delete().eq("id", existing.id);
    } else if (existing) {
      // different reaction — update
      await supabase
        .from("reactions")
        .update({ type: reactionLabel })
        .eq("id", existing.id);
    } else {
      // no existing reaction — insert
      await supabase.from("reactions").insert({
        workout_id: workoutId,
        user_id: userId,
        type: reactionLabel,
      });
    }

    // reload to refresh counts
    await loadFeed(userId);
  }

  function toggleComments(workoutId) {
    setOpenComments((prev) => ({
      ...prev,
      [workoutId]: !prev[workoutId],
    }));
  }

  async function handleAddComment(workoutId) {
    const text = (commentTexts[workoutId] || "").trim();
    if (!text || !userId) return;

    await supabase.from("comments").insert({
      workout_id: workoutId,
      user_id: userId,
      content: text,
    });

    setCommentTexts((prev) => ({ ...prev, [workoutId]: "" }));
    await loadFeed(userId);
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
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-900/60">
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
            className="mt-2 rounded-full bg-lime-500 px-5 py-2.5 text-sm font-bold text-black shadow-[0_0_15px_rgba(132,204,22,0.4)] transition-all duration-300 hover:shadow-[0_0_25px_rgba(132,204,22,0.6)]"
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
              (sum, ex) =>
                sum +
                (ex.sets || []).reduce(
                  (s, st) => s + Number(st.points || 0),
                  0
                ),
              0
            );
            const reactions = w.reactions || [];
            const comments = w.comments || [];
            const isCommentsOpen = openComments[w.id] || false;

            // count reactions per type
            const reactionCounts = {};
            const myReaction = reactions.find((r) => r.user_id === userId);
            for (const r of reactions) {
              reactionCounts[r.type] = (reactionCounts[r.type] || 0) + 1;
            }

            return (
              <li
                key={w.id}
                className="rounded-2xl border border-white/5 bg-neutral-900/60 backdrop-blur-md p-4"
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
                        &bull; {ex.custom_name}:{" "}
                        {(ex.sets || []).length}{" "}
                        {(ex.sets || []).length === 1 ? "set" : "sets"}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Footer: reactions + comments */}
                <div className="mt-3 flex items-center gap-1 border-t border-white/5 pt-3">
                  {REACTIONS.map(({ emoji, label }) => {
                    const count = reactionCounts[label] || 0;
                    const isActive = myReaction?.type === label;
                    return (
                      <button
                        key={label}
                        onClick={() => handleReaction(w.id, label)}
                        className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-base transition-colors hover:bg-neutral-800 ${
                          isActive
                            ? "bg-neutral-800 ring-1 ring-lime-500/50"
                            : ""
                        }`}
                      >
                        {emoji}
                        {count > 0 && (
                          <span
                            className={`text-xs font-medium ${
                              isActive ? "text-lime-400" : "text-neutral-500"
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => toggleComments(w.id)}
                    className={`ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-neutral-800 ${
                      isCommentsOpen
                        ? "text-lime-400"
                        : "text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    <MessageCircle size={16} />
                    <span className="text-xs">
                      {comments.length > 0 ? comments.length : "Comment"}
                    </span>
                  </button>
                </div>

                {/* Comments section (expandable) */}
                {isCommentsOpen && (
                  <div className="mt-3 space-y-3 border-t border-white/5 pt-3">
                    {/* Existing comments */}
                    {comments.length > 0 && (
                      <ul className="space-y-2">
                        {comments
                          .sort(
                            (a, b) =>
                              new Date(a.created_at) - new Date(b.created_at)
                          )
                          .map((c) => {
                            const cInitial = c.users?.username
                              ? c.users.username.charAt(0).toUpperCase()
                              : "?";
                            return (
                              <li key={c.id} className="flex gap-2">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-[10px] font-bold text-lime-400">
                                  {cInitial}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-xs font-medium text-white">
                                      {c.users?.username ?? "Unknown"}
                                    </span>
                                    <span className="text-[10px] text-neutral-600">
                                      {timeAgo(c.created_at)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-neutral-400">
                                    {c.content}
                                  </p>
                                </div>
                              </li>
                            );
                          })}
                      </ul>
                    )}

                    {/* Add comment form */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Write a comment..."
                        value={commentTexts[w.id] || ""}
                        onChange={(e) =>
                          setCommentTexts((prev) => ({
                            ...prev,
                            [w.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddComment(w.id);
                        }}
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-neutral-900/50 px-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-lime-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleAddComment(w.id)}
                        className="flex shrink-0 items-center justify-center rounded-full bg-lime-500 px-3 py-2 text-black shadow-[0_0_10px_rgba(132,204,22,0.3)] transition-all hover:shadow-[0_0_15px_rgba(132,204,22,0.5)]"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
