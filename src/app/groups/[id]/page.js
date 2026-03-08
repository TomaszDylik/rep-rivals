"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ArrowLeft, Trash2, Trophy, Dumbbell } from "lucide-react";

const METRICS = [
  { key: "has_weight", label: "Weight (kg)", badge: "kg" },
  { key: "has_reps", label: "Reps", badge: "reps" },
  { key: "has_distance", label: "Distance (km)", badge: "km" },
  { key: "has_time", label: "Time (min)", badge: "min" },
];

const TABS = [
  { id: "categories", label: "Categories", icon: Dumbbell },
  { id: "scoring", label: "Scoring Rules", icon: Trophy },
];

export default function GroupDetailPage() {
  const router = useRouter();
  const { id } = useParams();

  const [user, setUser] = useState(null);
  const [group, setGroup] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("categories");

  // create category form
  const [catName, setCatName] = useState("");
  const [multiplier, setMultiplier] = useState("");
  const [baseUnit, setBaseUnit] = useState("");
  const [metrics, setMetrics] = useState({
    has_weight: false,
    has_reps: false,
    has_distance: false,
    has_time: false,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const isAdmin = user && group && user.id === group.admin_id;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return router.push("/login");
      setUser(user);
      loadGroup();
      loadCategories();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadGroup() {
    const { data } = await supabase
      .from("groups")
      .select("id, name, invite_code, admin_id")
      .eq("id", id)
      .single();
    setGroup(data);
    setLoading(false);
  }

  async function loadCategories() {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("group_id", id)
      .order("name");
    if (data) setCategories(data);
  }

  function toggleMetric(key) {
    setMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function resetForm() {
    setCatName("");
    setMultiplier("");
    setBaseUnit("");
    setMetrics({ has_weight: false, has_reps: false, has_distance: false, has_time: false });
  }

  async function handleAddCategory(e) {
    e.preventDefault();
    setFormError("");
    const name = catName.trim();
    if (!name) return setFormError("Category name is required.");
    if (!Object.values(metrics).some(Boolean))
      return setFormError("Select at least one metric.");

    setSaving(true);
    const { error } = await supabase.from("categories").insert({
      group_id: id,
      name,
      ...metrics,
      points_multiplier: multiplier ? parseFloat(multiplier) : 1.0,
      base_unit: baseUnit.trim() || null,
    });

    if (error) {
      setFormError("Could not create category.");
    } else {
      resetForm();
      await loadCategories();
    }
    setSaving(false);
  }

  async function handleDelete(catId, catName) {
    if (!window.confirm(`Delete category "${catName}"? All linked exercises will be removed.`))
      return;
    await supabase.from("categories").delete().eq("id", catId);
    await loadCategories();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <p className="text-neutral-400">Loading...</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 gap-4">
        <p className="text-neutral-400">Group not found.</p>
        <Link href="/groups" className="text-sm text-lime-400 hover:underline">
          Back to groups
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-4 pb-24 pt-6">
      {/* Back link */}
      <Link
        href="/groups"
        className="inline-flex items-center gap-1 text-sm text-neutral-400 transition-colors hover:text-lime-400"
      >
        <ArrowLeft size={16} /> Back to groups
      </Link>

      {/* Group header */}
      <h1 className="mt-4 text-2xl font-bold text-white">{group.name}</h1>
      <p className="mt-1 font-mono text-xs text-neutral-500">
        Invite code: <span className="text-neutral-300">{group.invite_code}</span>
      </p>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 rounded-lg bg-neutral-900 p-1">
        {TABS.map(({ id: tid, label, icon: Icon }) => (
          <button
            key={tid}
            onClick={() => setTab(tid)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-colors ${
              tab === tid
                ? "bg-neutral-800 text-lime-400"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ============ CATEGORIES TAB ============ */}
      {tab === "categories" && (
        <>
          {/* Admin: Add category form */}
          {isAdmin && (
            <form
              onSubmit={handleAddCategory}
              className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
            >
              <h2 className="mb-3 text-sm font-semibold text-white">
                Add new category
              </h2>

              <input
                type="text"
                placeholder="Category name, e.g. Chest"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-white placeholder-neutral-500 focus:border-lime-500 focus:outline-none"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                {METRICS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleMetric(key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      metrics[key]
                        ? "border-lime-500 bg-lime-500/10 text-lime-400"
                        : "border-neutral-700 text-neutral-500 hover:border-neutral-500"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Scoring fields */}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Points multiplier, e.g. 100"
                  value={multiplier}
                  onChange={(e) => setMultiplier(e.target.value)}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-white placeholder-neutral-500 focus:border-lime-500 focus:outline-none sm:flex-1"
                />
                <input
                  type="text"
                  placeholder="Base unit, e.g. per 1 km"
                  value={baseUnit}
                  onChange={(e) => setBaseUnit(e.target.value)}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-white placeholder-neutral-500 focus:border-lime-500 focus:outline-none sm:flex-1"
                />
              </div>

              {formError && (
                <p className="mt-2 text-sm text-red-400">{formError}</p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="mt-3 w-full rounded-lg bg-lime-500 px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-400 disabled:opacity-50 sm:w-auto"
              >
                {saving ? "Saving..." : "Add category"}
              </button>
            </form>
          )}

          {/* Categories list */}
          <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Categories
          </h2>

          {categories.length === 0 ? (
            <p className="text-sm text-neutral-500">No categories yet.</p>
          ) : (
            <ul className="space-y-3">
              {categories.map((cat) => (
                <li
                  key={cat.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-white">{cat.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {METRICS.filter(({ key }) => cat[key]).map(({ key, badge }) => (
                        <span
                          key={key}
                          className="rounded bg-lime-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lime-400"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(cat.id, cat.name)}
                      className="ml-3 text-neutral-600 transition-colors hover:text-red-400"
                      title="Delete category"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* ============ SCORING RULES TAB ============ */}
      {tab === "scoring" && (
        <>
          <h2 className="mt-6 mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Scoring Rules
          </h2>

          {categories.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No categories defined yet. The admin needs to create categories first.
            </p>
          ) : (
            <ul className="space-y-3">
              {categories.map((cat) => (
                <li
                  key={cat.id}
                  className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3"
                >
                  <div className="flex items-baseline justify-between">
                    <p className="font-medium text-white">{cat.name}</p>
                    <span className="text-lg font-bold text-lime-400">
                      {cat.points_multiplier ?? 1} pt
                    </span>
                  </div>
                  {cat.base_unit && (
                    <p className="mt-1 text-xs text-neutral-500">
                      {cat.base_unit}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
