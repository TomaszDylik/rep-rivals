"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

function calcPoints(set, category) {
  const m = Number(category.points_multiplier) || 1;
  if (category.has_weight && category.has_reps && set.weight_kg && set.reps)
    return set.reps * set.weight_kg * m;
  if (category.has_distance && set.distance_km) return set.distance_km * m;
  if (category.has_time && set.time_min) return set.time_min * m;
  if (category.has_weight && set.weight_kg) return set.weight_kg * m;
  if (category.has_reps && set.reps) return set.reps * m;
  return 0;
}

export default function WorkoutDetailPage() {
  const router = useRouter();
  const { id } = useParams();

  const [workout, setWorkout] = useState(null);
  const [categories, setCategories] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  // add exercise form
  const [exName, setExName] = useState("");
  const [exCatId, setExCatId] = useState("");
  const [addingEx, setAddingEx] = useState(false);

  // add set form (per exercise)
  const [activeExId, setActiveExId] = useState(null);
  const [setFields, setSetFields] = useState({});

  const loadExercises = useCallback(async () => {
    const { data } = await supabase
      .from("exercises")
      .select("*, category:categories(*), sets(*)")
      .eq("workout_id", id)
      .order("custom_name");
    if (data) setExercises(data);
  }, [id]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return router.push("/login");
      loadWorkout();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadWorkout() {
    const { data } = await supabase
      .from("workouts")
      .select("*, groups(name)")
      .eq("id", id)
      .single();
    if (!data) { setLoading(false); return; }
    setWorkout(data);

    const { data: cats } = await supabase
      .from("categories")
      .select("*")
      .eq("group_id", data.group_id)
      .order("name");
    if (cats) setCategories(cats);

    await loadExercises();
    setLoading(false);
  }

  async function handleAddExercise(e) {
    e.preventDefault();
    if (!exName.trim() || !exCatId) return;
    setAddingEx(true);
    await supabase.from("exercises").insert({
      workout_id: id,
      custom_name: exName.trim(),
      category_id: exCatId,
    });
    setExName("");
    setExCatId("");
    await loadExercises();
    setAddingEx(false);
  }

  async function handleDeleteExercise(exId) {
    if (!window.confirm("Delete this exercise and all its sets?")) return;
    await supabase.from("exercises").delete().eq("id", exId);
    await loadExercises();
  }

  function getCatForExercise(ex) {
    return ex.category || categories.find((c) => c.id === ex.category_id);
  }

  async function handleAddSet(ex) {
    const cat = getCatForExercise(ex);
    if (!cat) return;
    const f = setFields[ex.id] || {};
    const reps = f.reps ? parseInt(f.reps) : null;
    const weight_kg = f.weight_kg ? parseFloat(f.weight_kg) : null;
    const distance_km = f.distance_km ? parseFloat(f.distance_km) : null;
    const time_min = f.time_min ? parseInt(f.time_min) : null;
    const pts = calcPoints({ reps, weight_kg, distance_km, time_min }, cat);

    await supabase.from("sets").insert({
      exercise_id: ex.id,
      reps, weight_kg, distance_km, time_min,
      points: Math.round(pts * 100) / 100,
    });
    setSetFields((prev) => ({ ...prev, [ex.id]: {} }));
    await loadExercises();
  }

  async function handleDeleteSet(setId) {
    await supabase.from("sets").delete().eq("id", setId);
    await loadExercises();
  }

  function updateField(exId, field, value) {
    setSetFields((prev) => ({
      ...prev,
      [exId]: { ...(prev[exId] || {}), [field]: value },
    }));
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 gap-4">
        <p className="text-neutral-400">Workout not found.</p>
        <Link href="/" className="text-sm text-lime-400">Go to Feed</Link>
      </div>
    );
  }

  const totalPts = exercises.reduce(
    (sum, ex) => sum + (ex.sets || []).reduce((s, st) => s + Number(st.points || 0), 0), 0
  );

  return (
    <div className="min-h-screen bg-neutral-950 px-4 pb-28 pt-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-lime-400">
        <ArrowLeft size={16} /> Feed
      </Link>

      <div className="mt-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-white">{workout.name}</h1>
        <span className="text-lg font-bold text-lime-400">+{Math.round(totalPts)} pts</span>
      </div>
      <p className="mt-1 text-xs text-neutral-500">{workout.groups?.name}</p>

      {/* Add exercise */}
      <form onSubmit={handleAddExercise} className="mt-6 flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="text-sm font-semibold text-white">Add Exercise</h2>
        <input
          type="text" placeholder="Exercise name, e.g. Bench Press"
          value={exName} onChange={(e) => setExName(e.target.value)}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-white placeholder-neutral-500 focus:border-lime-500 focus:outline-none"
        />
        <select
          value={exCatId} onChange={(e) => setExCatId(e.target.value)}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-white focus:border-lime-500 focus:outline-none"
        >
          <option value="">Select category...</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button type="submit" disabled={addingEx}
          className="w-full rounded-lg bg-lime-500 py-2.5 text-sm font-semibold text-black hover:bg-lime-400 disabled:opacity-50">
          <Plus size={16} className="mr-1 inline" />Add Exercise
        </button>
      </form>

      {/* Exercises list */}
      {exercises.map((ex) => {
        const cat = getCatForExercise(ex);
        const fields = setFields[ex.id] || {};
        const isOpen = activeExId === ex.id;
        return (
          <div key={ex.id} className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">{ex.custom_name}</p>
                <p className="text-xs text-neutral-500">{cat?.name}</p>
              </div>
              <button onClick={() => handleDeleteExercise(ex.id)} className="text-neutral-600 hover:text-red-400">
                <Trash2 size={16} />
              </button>
            </div>

            {/* Existing sets */}
            {(ex.sets || []).length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {ex.sets.map((s, i) => (
                  <li key={s.id} className="flex items-center justify-between rounded-md bg-neutral-800 px-3 py-2 text-xs text-neutral-300">
                    <span>
                      Set {i + 1}:
                      {s.reps != null && ` ${s.reps} reps`}
                      {s.weight_kg != null && ` ${s.weight_kg} kg`}
                      {s.distance_km != null && ` ${s.distance_km} km`}
                      {s.time_min != null && ` ${s.time_min} min`}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-lime-500/10 px-2 py-0.5 text-[10px] font-bold text-lime-400">
                        +{Math.round(Number(s.points || 0))} pts
                      </span>
                      <button onClick={() => handleDeleteSet(s.id)} className="text-neutral-600 hover:text-red-400">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Add set */}
            <button
              onClick={() => setActiveExId(isOpen ? null : ex.id)}
              className="mt-3 text-xs text-lime-400 hover:underline"
            >
              {isOpen ? "Cancel" : "+ Add set"}
            </button>

            {isOpen && cat && (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                {cat.has_reps && (
                  <input type="number" min="0" placeholder="Reps"
                    value={fields.reps || ""} onChange={(e) => updateField(ex.id, "reps", e.target.value)}
                    className="w-20 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-2 text-xs text-white placeholder-neutral-500 focus:border-lime-500 focus:outline-none" />
                )}
                {cat.has_weight && (
                  <input type="number" min="0" step="0.5" placeholder="kg"
                    value={fields.weight_kg || ""} onChange={(e) => updateField(ex.id, "weight_kg", e.target.value)}
                    className="w-20 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-2 text-xs text-white placeholder-neutral-500 focus:border-lime-500 focus:outline-none" />
                )}
                {cat.has_distance && (
                  <input type="number" min="0" step="0.01" placeholder="km"
                    value={fields.distance_km || ""} onChange={(e) => updateField(ex.id, "distance_km", e.target.value)}
                    className="w-20 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-2 text-xs text-white placeholder-neutral-500 focus:border-lime-500 focus:outline-none" />
                )}
                {cat.has_time && (
                  <input type="number" min="0" placeholder="min"
                    value={fields.time_min || ""} onChange={(e) => updateField(ex.id, "time_min", e.target.value)}
                    className="w-20 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-2 text-xs text-white placeholder-neutral-500 focus:border-lime-500 focus:outline-none" />
                )}
                <button onClick={() => handleAddSet(ex)}
                  className="rounded-md bg-lime-500 px-3 py-2 text-xs font-semibold text-black hover:bg-lime-400">
                  Save
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Finish */}
      <button
        onClick={() => router.push("/")}
        className="mt-6 w-full rounded-lg border border-lime-500 py-3 text-sm font-semibold text-lime-400 transition-colors hover:bg-lime-500 hover:text-black"
      >
        Finish Workout
      </button>
    </div>
  );
}
