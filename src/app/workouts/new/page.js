"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NewWorkoutPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return router.push("/login");
      setUser(user);
      loadGroups(user.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadGroups(userId) {
    const { data } = await supabase
      .from("group_members")
      .select("group_id, groups(id, name)")
      .eq("user_id", userId);
    if (data) setGroups(data.map((r) => r.groups));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    if (!selectedGroup) return setError("Select a group.");
    if (!name.trim()) return setError("Enter a workout name.");

    setCreating(true);
    const { data, error: err } = await supabase
      .from("workouts")
      .insert({ name: name.trim(), group_id: selectedGroup, user_id: user.id })
      .select("id")
      .single();

    if (err || !data) {
      setError("Could not create workout.");
      setCreating(false);
      return;
    }
    router.push(`/workouts/${data.id}`);
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-4 pb-24 pt-6">
      <h1 className="text-2xl font-bold text-white">New Workout</h1>

      <form onSubmit={handleCreate} className="mt-6 flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm text-neutral-400">Group</label>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-neutral-900/50 px-4 py-3 text-sm text-white focus:border-lime-500 focus:outline-none"
          >
            <option value="">Select a group...</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-neutral-400">Workout name</label>
          <input
            type="text"
            placeholder="e.g. Upper Body Push"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-neutral-900/50 px-4 py-3 text-sm text-white placeholder-neutral-500 focus:border-lime-500 focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={creating}
          className="w-full rounded-full bg-lime-500 py-3 text-sm font-bold text-black shadow-[0_0_15px_rgba(132,204,22,0.4)] transition-all duration-300 hover:shadow-[0_0_25px_rgba(132,204,22,0.6)] hover:bg-lime-400 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Start Workout"}
        </button>
      </form>
    </div>
  );
}
