"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import {
  UserCheck,
  ChevronDown,
  Check,
  Loader2,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  jobId: string;
  /** The staffProfile.id of the currently assigned primary photographer (if any) */
  currentStaffProfileId?: string | null;
  /** Display name of the current assignee */
  currentAssigneeName?: string | null;
  onAssigned?: () => void;
  /** Job scheduling data — when provided, enables conflict checking */
  schedulingData?: {
    propertyAddress: string;
    propertyCity: string;
    propertyState: string;
    propertyZip?: string | null;
    scheduledAt: Date;
    estimatedDurationMins: number;
  };
}

export function JobAssignmentPicker({
  jobId,
  currentStaffProfileId,
  currentAssigneeName,
  onAssigned,
  schedulingData,
}: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // ── With scheduling data: use conflict-aware query ──────────────────────
  const { data: availableStaff, isLoading: isLoadingAvailability } =
    api.scheduling.getAvailableStaff.useQuery(
      schedulingData
        ? {
            propertyAddress: schedulingData.propertyAddress,
            propertyCity: schedulingData.propertyCity,
            propertyState: schedulingData.propertyState,
            propertyZip: schedulingData.propertyZip ?? undefined,
            scheduledAt: schedulingData.scheduledAt,
            estimatedDurationMins: schedulingData.estimatedDurationMins,
            excludeJobId: jobId,
          }
        : {
            propertyAddress: "",
            propertyCity: "",
            propertyState: "",
            scheduledAt: new Date(),
            estimatedDurationMins: 90,
          },
      {
        enabled: !!schedulingData && open,
        staleTime: 30_000,
      }
    );

  // ── Fallback: plain staff list when no scheduling data ───────────────────
  const { data: staffList, isLoading: isLoadingStaff } = api.staff.list.useQuery(
    { isActive: true },
    {
      enabled: !schedulingData,
      staleTime: 60_000,
    }
  );

  const assignMutation = api.jobs.assign.useMutation({
    onSuccess: () => {
      setOpen(false);
      onAssigned?.();
      router.refresh();
    },
  });

  function handleSelect(staffProfileId: string) {
    if (staffProfileId === currentStaffProfileId) {
      setOpen(false);
      return;
    }
    assignMutation.mutate({
      jobId,
      staffId: staffProfileId,
      isPrimary: true,
      role: "PHOTOGRAPHER",
    });
  }

  const isLoading = schedulingData ? isLoadingAvailability : isLoadingStaff;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={assignMutation.isPending}
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors",
          currentStaffProfileId
            ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            : "border-dashed border-gray-300 bg-white text-gray-500 hover:border-blue-300 hover:text-blue-600"
        )}
      >
        {assignMutation.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : currentStaffProfileId ? (
          <UserCheck className="w-3.5 h-3.5" />
        ) : (
          <UserPlus className="w-3.5 h-3.5" />
        )}
        <span>
          {assignMutation.isPending
            ? "Assigning…"
            : currentAssigneeName ?? "Assign photographer"}
        </span>
        {!assignMutation.isPending && (
          <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
        )}
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-full mt-1.5 z-20 min-w-[240px] rounded-xl bg-white shadow-lg border border-gray-100 py-1 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center gap-2 px-3 py-3 text-xs text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {schedulingData ? "Checking availability…" : "Loading staff…"}
              </div>
            ) : schedulingData && availableStaff ? (
              // ── Conflict-aware list ──────────────────────────────────────
              <>
                {availableStaff.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-gray-400">No staff found</p>
                ) : (
                  availableStaff.map((staff) => {
                    const isAssigned = staff.staffId === currentStaffProfileId;
                    const hasConflict = !staff.isAvailable && staff.conflictResult.hasConflict;
                    const isUnavailable = !staff.isAvailable && !staff.conflictResult.hasConflict;

                    return (
                      <button
                        key={staff.staffId}
                        type="button"
                        onClick={() => handleSelect(staff.staffId)}
                        className={cn(
                          "flex items-start gap-2.5 w-full px-3 py-2.5 text-left text-sm transition-colors",
                          isAssigned
                            ? "bg-blue-50 text-blue-700"
                            : isUnavailable
                            ? "opacity-50 cursor-not-allowed text-gray-500 hover:bg-gray-50"
                            : hasConflict
                            ? "text-gray-700 hover:bg-amber-50"
                            : "text-gray-700 hover:bg-green-50"
                        )}
                      >
                        {/* Avatar */}
                        <div
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0 mt-0.5",
                            isAssigned
                              ? "bg-blue-100 text-blue-700"
                              : hasConflict
                              ? "bg-amber-100 text-amber-700"
                              : isUnavailable
                              ? "bg-gray-100 text-gray-500"
                              : "bg-green-100 text-green-700"
                          )}
                        >
                          {staff.staffName?.[0]?.toUpperCase() ?? "?"}
                        </div>

                        {/* Name + status */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium leading-tight truncate">{staff.staffName}</p>
                          {staff.unavailableReason ? (
                            <p className={cn(
                              "text-[10px] leading-tight mt-0.5 line-clamp-2",
                              hasConflict ? "text-amber-600" : "text-gray-400"
                            )}>
                              {staff.unavailableReason}
                            </p>
                          ) : (
                            <p className="text-[10px] text-green-600 leading-tight mt-0.5">
                              Available
                            </p>
                          )}
                        </div>

                        {/* Status icon */}
                        {isAssigned ? (
                          <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                        ) : hasConflict ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        ) : isUnavailable ? (
                          <XCircle className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })
                )}

                <div className="border-t border-gray-100 px-3 py-1.5 mt-1">
                  <p className="text-[10px] text-gray-400">
                    🟢 Available &nbsp; 🟡 Travel conflict &nbsp; ⬜ Unavailable
                  </p>
                </div>
              </>
            ) : (
              // ── Plain list (no scheduling data) ──────────────────────────
              <>
                {(staffList ?? [])
                  .filter(
                    (m) =>
                      m.role === "PHOTOGRAPHER" ||
                      m.role === "ADMIN" ||
                      m.role === "MANAGER" ||
                      m.role === "OWNER"
                  )
                  .map((member) => {
                    const profileId = member.staffProfile?.id;
                    const isAssigned = profileId === currentStaffProfileId;
                    return (
                      <button
                        key={member.id}
                        type="button"
                        disabled={!profileId}
                        onClick={() => profileId && handleSelect(profileId)}
                        className={cn(
                          "flex items-center gap-2.5 w-full px-3 py-2.5 text-left text-sm transition-colors",
                          isAssigned
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-700 hover:bg-gray-50",
                          !profileId && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold shrink-0">
                          {member.user.fullName?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium leading-tight truncate">{member.user.fullName}</p>
                          <p className="text-[10px] text-gray-400 capitalize leading-tight">
                            {member.role.toLowerCase()}
                          </p>
                        </div>
                        {isAssigned && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
