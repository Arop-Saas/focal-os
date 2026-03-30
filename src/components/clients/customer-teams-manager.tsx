"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { cn, formatCurrency } from "@/lib/utils";
import { Plus, X, Pencil, Trash2, Users, ChevronDown, ChevronRight, Tag, Check, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Team = {
  id: string;
  name: string;
  credits: number;
  notes: string | null;
  brokerageGroupId: string | null;
  brokerageGroup: { id: string; name: string; discountType: string; discountValue: number } | null;
  _count: { members: number };
};

type TeamMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  creditBalance: number;
};

type BrokerageGroup = {
  id: string;
  name: string;
  discountType: string;
  discountValue: number;
};

function discountLabel(type: string, value: number) {
  return type === "PERCENTAGE" ? `${value}% off` : `${formatCurrency(value)} off`;
}

function TeamForm({
  initial,
  brokerageGroups,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: { name: string; notes: string; brokerageGroupId: string };
  brokerageGroups: BrokerageGroup[];
  onSave: (f: { name: string; notes: string; brokerageGroupId: string }) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Team Name *</label>
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. RE/MAX VIP Team" className="h-9" disabled={isSaving} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Brokerage Pricing Group <span className="font-normal text-gray-400">(optional)</span></label>
        <select
          value={form.brokerageGroupId}
          onChange={(e) => set("brokerageGroupId", e.target.value)}
          disabled={isSaving}
          className="w-full h-9 px-3 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— None —</option>
          {brokerageGroups.map((g) => (
            <option key={g.id} value={g.id}>{g.name} ({discountLabel(g.discountType, g.discountValue)})</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Notes <span className="font-normal text-gray-400">(optional)</span></label>
        <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Internal notes…" className="h-9" disabled={isSaving} />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} disabled={isSaving}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
          Cancel
        </button>
        <button type="button" onClick={() => onSave(form)} disabled={isSaving || !form.name.trim()}
          className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

export function CustomerTeamsManager() {
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");

  const { data: teams, refetch: refetchTeams } = trpc.teams.list.useQuery();
  const { data: brokerageGroups } = trpc.brokerages.list.useQuery();
  const { data: teamDetail, refetch: refetchDetail } = trpc.teams.getById.useQuery(
    { id: expandedTeamId! },
    { enabled: !!expandedTeamId }
  );
  const { data: allClients } = trpc.clients.list.useQuery(
    { search: memberSearch, limit: 20 },
    { enabled: !!addMemberTeamId }
  );

  const createMutation = trpc.teams.create.useMutation();
  const updateMutation = trpc.teams.update.useMutation();
  const deleteMutation = trpc.teams.delete.useMutation();
  const addMemberMutation = trpc.teams.addMember.useMutation();
  const removeMemberMutation = trpc.teams.removeMember.useMutation();

  const handleCreate = async (form: { name: string; notes: string; brokerageGroupId: string }) => {
    setIsSaving(true);
    try {
      await createMutation.mutateAsync({
        name: form.name,
        notes: form.notes || undefined,
        brokerageGroupId: form.brokerageGroupId || undefined,
      });
      setShowCreateForm(false);
      await refetchTeams();
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (teamId: string, form: { name: string; notes: string; brokerageGroupId: string }) => {
    setIsSaving(true);
    try {
      await updateMutation.mutateAsync({
        id: teamId,
        name: form.name,
        notes: form.notes || null,
        brokerageGroupId: form.brokerageGroupId || null,
      });
      setEditingTeamId(null);
      await refetchTeams();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (teamId: string) => {
    if (!confirm("Delete this team? Members will be unassigned.")) return;
    await deleteMutation.mutateAsync({ id: teamId });
    if (expandedTeamId === teamId) setExpandedTeamId(null);
    await refetchTeams();
  };

  const handleAddMember = async (clientId: string, teamId: string) => {
    await addMemberMutation.mutateAsync({ teamId, clientId });
    await Promise.all([refetchTeams(), refetchDetail()]);
  };

  const handleRemoveMember = async (clientId: string) => {
    await removeMemberMutation.mutateAsync({ clientId });
    await Promise.all([refetchTeams(), refetchDetail()]);
  };

  const groups = (brokerageGroups as BrokerageGroup[] | undefined) ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{teams?.length ?? 0} team{teams?.length !== 1 ? "s" : ""}</p>
        {!showCreateForm && (
          <Button size="sm" onClick={() => setShowCreateForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New Team
          </Button>
        )}
      </div>

      {showCreateForm && (
        <TeamForm
          initial={{ name: "", notes: "", brokerageGroupId: "" }}
          brokerageGroups={groups}
          onSave={handleCreate}
          onCancel={() => setShowCreateForm(false)}
          isSaving={isSaving}
        />
      )}

      {!teams || teams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-500">No customer teams yet</p>
          <p className="text-xs text-gray-400 mt-1">Create a team to group clients and apply shared pricing.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(teams as Team[]).map((team) => {
            const isExpanded = expandedTeamId === team.id;
            const isEditing = editingTeamId === team.id;

            return (
              <div key={team.id} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                {/* Team header row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => { setExpandedTeamId(isExpanded ? null : team.id); setAddMemberTeamId(null); }}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                    <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <Users className="h-3.5 w-3.5 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{team.name}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-500">{team._count.members} member{team._count.members !== 1 ? "s" : ""}</span>
                        {team.brokerageGroup && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md">
                            <Tag className="h-2.5 w-2.5" />{team.brokerageGroup.name}
                          </span>
                        )}
                        {team.credits > 0 && (
                          <span className="text-[10px] text-green-600 font-medium">{formatCurrency(team.credits)} credits</span>
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditingTeamId(isEditing ? null : team.id)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
                      <Pencil className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                    <button onClick={() => handleDelete(team.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Edit form */}
                {isEditing && (
                  <div className="px-4 pb-3">
                    <TeamForm
                      initial={{ name: team.name, notes: team.notes ?? "", brokerageGroupId: team.brokerageGroupId ?? "" }}
                      brokerageGroups={groups}
                      onSave={(form) => handleUpdate(team.id, form)}
                      onCancel={() => setEditingTeamId(null)}
                      isSaving={isSaving}
                    />
                  </div>
                )}

                {/* Expanded members */}
                {isExpanded && !isEditing && (
                  <div className="border-t border-gray-100 bg-gray-50">
                    {/* Members list */}
                    {teamDetail?.members && teamDetail.members.length > 0 ? (
                      <div className="divide-y divide-gray-100">
                        {(teamDetail.members as TeamMember[]).map((member) => (
                          <div key={member.id} className="flex items-center gap-3 px-4 py-2.5">
                            <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 shrink-0">
                              {member.firstName[0]}{member.lastName[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{member.firstName} {member.lastName}</p>
                              <p className="text-xs text-gray-400 truncate">{member.email}</p>
                            </div>
                            {member.creditBalance > 0 && (
                              <span className="text-xs text-green-600 font-medium shrink-0">{formatCurrency(member.creditBalance)}</span>
                            )}
                            <button onClick={() => handleRemoveMember(member.id)}
                              className="p-1 hover:bg-red-50 rounded transition-colors shrink-0" title="Remove from team">
                              <UserMinus className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-4">No members yet</p>
                    )}

                    {/* Add member section */}
                    <div className="p-3 border-t border-gray-100">
                      {addMemberTeamId === team.id ? (
                        <div className="space-y-2">
                          <Input
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            placeholder="Search clients to add…"
                            className="h-8 text-xs"
                          />
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {allClients?.clients
                              .filter((c: any) => c.teamId !== team.id)
                              .map((c: any) => (
                                <button key={c.id} onClick={() => { handleAddMember(c.id, team.id); setAddMemberTeamId(null); setMemberSearch(""); }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-blue-50 text-left transition-colors">
                                  <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-600 shrink-0">
                                    {c.firstName[0]}{c.lastName[0]}
                                  </div>
                                  <span className="text-xs font-medium text-gray-800 truncate">{c.firstName} {c.lastName}</span>
                                  <span className="text-[10px] text-gray-400 truncate ml-auto">{c.email}</span>
                                </button>
                              ))}
                          </div>
                          <button onClick={() => { setAddMemberTeamId(null); setMemberSearch(""); }}
                            className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setAddMemberTeamId(team.id)}
                          className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1 py-1">
                          <Plus className="h-3 w-3" /> Add Member
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
