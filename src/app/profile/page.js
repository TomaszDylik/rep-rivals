"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LogOut, Trash2, Pencil } from "lucide-react";

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

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return router.push("/login");
      loadProfile(user.id);
      loadWorkouts(user.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfile(uid) {
    const { data } = await supabase
      .from("users")
      .select("id, username, email")
      .eq("id", uid)
      .single();
    if (data) setProfile(data);
    setLoading(false);
  }

  async function loadWorkouts(uid) {
    const { data } = await supabase
      .from("workouts")
      .select("id, name, created_at, groups(name), exercises(custom_name, sets(points))")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (data) setWorkouts(data);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleDeleteWorkout(workoutId) {
    if (!window.confirm("Czy na pewno chcesz usunąć ten trening?")) return;
    await supabase.from("workouts").delete().eq("id", workoutId);
    setWorkouts((prev) => prev.filter((w) => w.id !== workoutId));
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <p className="text-neutral-400">Loading...</p>
      </div>
    );
  }

  const totalWorkouts = workouts.length;
  const totalPoints = workouts.reduce(
    (sum, w) =>
      sum +
      (w.exercises || []).reduce(
        (eSum, ex) =>
          eSum + (ex.sets || []).reduce((sSum, s) => sSum + Number(s.points || 0), 0),
        0
      ),
    0
  );

  const initial = profile?.username
    ? profile.username.charAt(0).toUpperCase()
    : "?";

  return (
    <div className="min-h-screen bg-neutral-950 px-4 pb-24 pt-6">
      {/* Avatar + user info */}
      <div className="flex flex-col items-center gap-3 pt-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-800 text-3xl font-bold text-lime-400">
          {initial}
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-white">{profile?.username}</p>
          <p className="text-sm text-neutral-500">{profile?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="mt-2 flex items-center gap-2 rounded-lg bg-red-500/10 px-6 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20"
        >
          <LogOut size={16} />
          Wyloguj się
        </button>
      </div>

      {/* Stats grid */}
      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-center">
          <p className="text-2xl font-bold text-lime-400">{totalWorkouts}</p>
          <p className="mt-1 text-xs text-neutral-500">Suma Treningów</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-center">
          <p className="text-2xl font-bold text-lime-400">{Math.round(totalPoints)}</p>
          <p className="mt-1 text-xs text-neutral-500">Zdobyte Punkty</p>
        </div>
      </div>

      {/* Workout history */}
      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
        Moja historia
      </h2>

      {workouts.length === 0 ? (
        <p className="text-sm text-neutral-500">Brak treningów.</p>
      ) : (
        <ul className="space-y-3">
          {workouts.map((w) => {
            const exercises = w.exercises || [];
            const pts = exercises.reduce(
              (sum, ex) =>
                sum + (ex.sets || []).reduce((s, st) => s + Number(st.points || 0), 0),
              0
            );
            return (
              <li
                key={w.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {w.name}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {w.groups?.name} &middot; {timeAgo(w.created_at)}
                  </p>
                  <p className="mt-1 text-xs text-neutral-600">
                    {exercises.length} {exercises.length === 1 ? "exercise" : "exercises"}
                  </p>
                </div>
                {pts > 0 && (
                  <span className="shrink-0 text-sm font-bold text-lime-400">
                    +{Math.round(pts)} pts
                  </span>
                )}
                <button
                  onClick={() => router.push(`/workouts/${w.id}/edit`)}
                  className="shrink-0 rounded-lg p-2 text-neutral-600 transition-colors hover:bg-neutral-800 hover:text-lime-400"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDeleteWorkout(w.id)}
                  className="shrink-0 rounded-lg p-2 text-neutral-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
