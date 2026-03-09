"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Trash2, Save } from "lucide-react";
import Link from "next/link";

function calcPoints(set, category) {
  let totalValue = 0;
  if (category.has_weight && category.has_reps && set.weight_kg && set.reps) {
    totalValue = set.weight_kg * set.reps;
  } else if (category.has_distance && set.distance_km) {
    totalValue = set.distance_km;
  } else if (category.has_time && set.time_min) {
    totalValue = set.time_min;
  } else if (category.has_reps && set.reps) {
    totalValue = set.reps;
  }
  if (totalValue === 0) return 0;
  const baseUnitValue =
    parseFloat((category.base_unit || "").match(/\d+(\.\d+)?/)?.[0]) || 1;
  const m = Number(category.points_multiplier) || 1;
  return Math.round((totalValue / baseUnitValue) * m);
}

export default function EditWorkoutPage() {
  const router = useRouter();
  const { id } = useParams();

  const [workout, setWorkout] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [catMap, setCatMap] = useState({});
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return router.push("/login");
      loadData(user.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadData(uid) {
    const { data: wo } = await supabase
      .from("workouts")
      .select("id, name, user_id, group_id, groups(name)")
      .eq("id", id)
      .single();

    if (!wo || wo.user_id !== uid) {
      setLoading(false);
      return;
    }
    setWorkout(wo);

    const { data: cats } = await supabase
      .from("categories")
      .select("*")
      .eq("group_id", wo.group_id);
    const map = {};
    (cats || []).forEach((c) => (map[c.id] = c));
    setCatMap(map);

    const { data: exs } = await supabase
      .from("exercises")
      .select("*, sets(*)")
      .eq("workout_id", id)
      .order("custom_name");

    if (exs) {
      setExercises(exs);
      const initial = {};
      exs.forEach((ex) =>
        (ex.sets || []).forEach((s) => {
          initial[s.id] = {
            reps: s.reps ?? "",
            weight_kg: s.weight_kg ?? "",
            distance_km: s.distance_km ?? "",
            time_min: s.time_min ?? "",
          };
        })
      );
      setEdits(initial);
    }
    setLoading(false);
  }

  function updateField(setId, field, value) {
    setEdits((prev) => ({
      ...prev,
      [setId]: { ...prev[setId], [field]: value },
    }));
  }

  async function handleDeleteSet(setId) {
    await supabase.from("sets").delete().eq("id", setId);
    setExercises((prev) =>
      prev.map((ex) => ({
        ...ex,
        sets: (ex.sets || []).filter((s) => s.id !== setId),
      }))
    );
    setEdits((prev) => {
      const next = { ...prev };
      delete next[setId];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const updates = [];

    for (const ex of exercises) {
      const cat = catMap[ex.category_id];
      if (!cat) continue;

      for (const s of ex.sets || []) {
        const e = edits[s.id];
        if (!e) continue;

        const reps = e.reps !== "" ? parseInt(e.reps) : null;
        const weight_kg = e.weight_kg !== "" ? parseFloat(e.weight_kg) : null;
        const distance_km = e.distance_km !== "" ? parseFloat(e.distance_km) : null;
        const time_min = e.time_min !== "" ? parseInt(e.time_min) : null;
        const points = calcPoints({ reps, weight_kg, distance_km, time_min }, cat);

        updates.push(
          supabase
            .from("sets")
            .update({ reps, weight_kg, distance_km, time_min, points })
            .eq("id", s.id)
        );
      }
    }

    await Promise.all(updates);
    setSaving(false);
    alert("Zapisano zmiany!");
    router.push("/profile");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <p className="text-neutral-400">Loading...</p>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950">
        <p className="text-neutral-400">Workout not found or access denied.</p>
        <Link href="/profile" className="text-sm text-lime-400">Back to Profile</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-4 pb-24 pt-6">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-lime-400"
      >
        <ArrowLeft size={16} /> Profile
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-white">Edit: {workout.name}</h1>
      <p className="mt-1 text-xs text-neutral-500">{workout.groups?.name}</p>

      {exercises.map((ex) => {
        const cat = catMap[ex.category_id];
        return (
          <div
            key={ex.id}
            className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
          >
            <p className="font-medium text-white">{ex.custom_name}</p>
            <p className="text-xs text-neutral-500">{cat?.name}</p>

            {(ex.sets || []).length === 0 && (
              <p className="mt-2 text-xs text-neutral-600">No sets.</p>
            )}

            {(ex.sets || []).map((s, i) => {
              const e = edits[s.id] || {};
              const reps = e.reps !== "" ? parseInt(e.reps) : null;
              const weight_kg = e.weight_kg !== "" ? parseFloat(e.weight_kg) : null;
              const distance_km = e.distance_km !== "" ? parseFloat(e.distance_km) : null;
              const time_min = e.time_min !== "" ? parseInt(e.time_min) : null;
              const pts = cat
                ? calcPoints({ reps, weight_kg, distance_km, time_min }, cat)
                : 0;

              return (
                <div
                  key={s.id}
                  className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-neutral-800 p-2"
                >
                  <span className="text-xs font-medium text-neutral-500 w-12">
                    Set {i + 1}
                  </span>

                  {cat?.has_reps && (
                    <input
                      type="number" min="0" placeholder="Reps"
                      value={e.reps ?? ""}
                      onChange={(ev) => updateField(s.id, "reps", ev.target.value)}
                      className="w-20 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-lime-500 focus:outline-none"
                    />
                  )}
                  {cat?.has_weight && (
                    <input
                      type="number" min="0" step="0.5" placeholder="kg"
                      value={e.weight_kg ?? ""}
                      onChange={(ev) => updateField(s.id, "weight_kg", ev.target.value)}
                      className="w-20 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-lime-500 focus:outline-none"
                    />
                  )}
                  {cat?.has_distance && (
                    <input
                      type="number" min="0" step="0.01" placeholder="km"
                      value={e.distance_km ?? ""}
                      onChange={(ev) => updateField(s.id, "distance_km", ev.target.value)}
                      className="w-20 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-lime-500 focus:outline-none"
                    />
                  )}
                  {cat?.has_time && (
                    <input
                      type="number" min="0" placeholder="min"
                      value={e.time_min ?? ""}
                      onChange={(ev) => updateField(s.id, "time_min", ev.target.value)}
                      className="w-20 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-lime-500 focus:outline-none"
                    />
                  )}

                  <span className="rounded bg-lime-500/10 px-2 py-0.5 text-[10px] font-bold text-lime-400">
                    +{pts} pts
                  </span>

                  <button
                    onClick={() => handleDeleteSet(s.id)}
                    className="ml-auto rounded p-1 text-neutral-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-lime-500 py-3 text-sm font-semibold text-black transition-colors hover:bg-lime-400 disabled:opacity-50"
      >
        <Save size={16} />
        {saving ? "Saving..." : "Zapisz zmiany"}
      </button>
    </div>
  );
}
