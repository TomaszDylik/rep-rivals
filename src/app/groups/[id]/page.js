"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";

const METRICS = [
  { key: "has_weight", label: "Weight (kg)", badge: "kg" },
  { key: "has_reps", label: "Reps", badge: "reps" },
  { key: "has_distance", label: "Distance (km)", badge: "km" },
  { key: "has_time", label: "Time (min)", badge: "min" },
];

export default function GroupDetailPage() {
  const router = useRouter();
  const { id } = useParams();

  const [user, setUser] = useState(null);
  const [group, setGroup] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // create category form
  const [catName, setCatName] = useState("");
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

  async function handleAddCategory(e) {
    e.preventDefault();
    setFormError("");
    const name = catName.trim();
    if (!name) return setFormError("Category name is required.");
    if (!Object.values(metrics).some(Boolean))
      return setFormError("Select at least one metric.");

    setSaving(true);
    const { error } = await supabase
      .from("categories")
      .insert({ group_id: id, name, ...metrics });

    if (error) {
      setFormError("Could not create category.");
    } else {
      setCatName("");
      setMetrics({ has_weight: false, has_reps: false, has_distance: false, has_time: false });
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

      {/* ---- Admin: Add category form ---- */}
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

          {formError && (
            <p className="mt-2 text-sm text-red-400">{formError}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="mt-3 rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-lime-400 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add category"}
          </button>
        </form>
      )}

      {/* ---- Categories list ---- */}
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
    </div>
  );
}
