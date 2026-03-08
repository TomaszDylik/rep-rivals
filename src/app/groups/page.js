"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Plus, LogIn, Copy, Check, ChevronRight } from "lucide-react";

export default function GroupsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // join form
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  // create form
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // copied invite code feedback
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
      } else {
        setUser(user);
        fetchGroups(user.id);
      }
    });
  }, [router]);

  async function fetchGroups(userId) {
    setLoading(true);
    const { data, error } = await supabase
      .from("group_members")
      .select("group_id, groups(id, name, invite_code, admin_id)")
      .eq("user_id", userId);

    if (!error && data) {
      setGroups(data.map((row) => row.groups));
    }
    setLoading(false);
  }

  async function handleJoin(e) {
    e.preventDefault();
    setJoinError("");
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinError("Code must be 6 characters.");
      return;
    }

    setJoining(true);

    // find group by invite code
    const { data: group, error: findErr } = await supabase
      .from("groups")
      .select("id")
      .eq("invite_code", code)
      .single();

    if (findErr || !group) {
      setJoinError("Invalid invite code.");
      setJoining(false);
      return;
    }

    // check if already a member
    const { data: existing } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", group.id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      setJoinError("You are already in this group.");
      setJoining(false);
      return;
    }

    // join
    const { error: joinErr } = await supabase
      .from("group_members")
      .insert({ group_id: group.id, user_id: user.id });

    if (joinErr) {
      setJoinError("Could not join group.");
    } else {
      setJoinCode("");
      await fetchGroups(user.id);
    }
    setJoining(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError("");
    const name = groupName.trim();
    if (!name) {
      setCreateError("Group name is required.");
      return;
    }

    setCreating(true);

    // create group (trigger generates invite_code)
    const { data: newGroup, error: createErr } = await supabase
      .from("groups")
      .insert({ name, admin_id: user.id })
      .select()
      .single();

    if (createErr) {
      setCreateError("Could not create group.");
      setCreating(false);
      return;
    }

    // add creator as member
    await supabase
      .from("group_members")
      .insert({ group_id: newGroup.id, user_id: user.id });

    setGroupName("");
    setShowCreate(false);
    await fetchGroups(user.id);
    setCreating(false);
  }

  function copyCode(code, groupId) {
    navigator.clipboard.writeText(code);
    setCopiedId(groupId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <p className="text-neutral-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-4 pb-24 pt-6">
      <h1 className="text-2xl font-bold text-white">Groups</h1>

      {/* ---- Join Group ---- */}
      <form onSubmit={handleJoin} className="mt-6 flex gap-2">
        <input
          type="text"
          maxLength={6}
          placeholder="Invite code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm uppercase tracking-widest text-white placeholder-neutral-500 focus:border-lime-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={joining}
          className="flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-lime-400 disabled:opacity-50"
        >
          <LogIn size={16} />
          Join
        </button>
      </form>
      {joinError && (
        <p className="mt-2 text-sm text-red-400">{joinError}</p>
      )}

      {/* ---- Create Group ---- */}
      <div className="mt-6">
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-700 py-3 text-sm text-neutral-400 transition-colors hover:border-lime-500 hover:text-lime-400"
          >
            <Plus size={16} />
            Create new group
          </button>
        ) : (
          <form
            onSubmit={handleCreate}
            className="rounded-lg border border-neutral-800 bg-neutral-900 p-4"
          >
            <label className="mb-2 block text-sm text-neutral-400">
              Group name
            </label>
            <input
              type="text"
              placeholder="e.g. Gym Bros"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-white placeholder-neutral-500 focus:border-lime-500 focus:outline-none"
            />
            {createError && (
              <p className="mt-2 text-sm text-red-400">{createError}</p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-lime-400 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setCreateError("");
                }}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400 transition-colors hover:text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ---- My Groups List ---- */}
      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
        My Groups
      </h2>

      {groups.length === 0 ? (
        <p className="text-sm text-neutral-500">
          You haven&apos;t joined any groups yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3"
            >
              <Link href={`/groups/${g.id}`} className="flex-1">
                <p className="font-medium text-white">{g.name}</p>
                <p className="mt-0.5 font-mono text-xs text-neutral-500">
                  {g.invite_code}
                </p>
              </Link>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyCode(g.invite_code, g.id)}
                  className="text-neutral-500 transition-colors hover:text-lime-400"
                  title="Copy invite code"
                >
                  {copiedId === g.id ? (
                    <Check size={18} className="text-lime-400" />
                  ) : (
                    <Copy size={18} />
                  )}
                </button>
                <Link href={`/groups/${g.id}`} className="text-neutral-600">
                  <ChevronRight size={18} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
