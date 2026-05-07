"use client";

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc/client";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Plus, X, ToggleRight, ToggleLeft, Star, Pencil, Clock, Camera,
  Video, Plane, Boxes, FileText, Layers, Sunset, Share2, Zap,
  HelpCircle, Timer, CheckCircle2, ChevronDown, Tag, Building2,
  Upload, Loader2, Image as ImageIcon, Play, Trash2, MapPin, LayoutTemplate,
} from "lucide-react";
import { BrokerageGroupsManager } from "@/components/brokerages/brokerage-groups-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getEffectiveCover, STOCK_COVERS, isVideoUrl } from "@/lib/stock-covers";

/* ─── Category metadata ────────────────────────────────────────────── */
const CATEGORY_META: Record<string, { label: string; color: string; bg: string; light: string; icon: React.ElementType }> = {
  PHOTOGRAPHY:     { label: "Photography",     color: "text-blue-700",   bg: "bg-blue-600",   light: "bg-blue-50 border-blue-200 text-blue-700",   icon: Camera },
  VIDEO:           { label: "Video",           color: "text-purple-700", bg: "bg-purple-600", light: "bg-purple-50 border-purple-200 text-purple-700", icon: Video },
  DRONE:           { label: "Drone",           color: "text-red-700",    bg: "bg-red-600",    light: "bg-red-50 border-red-200 text-red-700",       icon: Plane },
  VIRTUAL_TOUR_3D: { label: "3D Virtual Tour", color: "text-cyan-700",   bg: "bg-cyan-600",   light: "bg-cyan-50 border-cyan-200 text-cyan-700",    icon: Boxes },
  FLOOR_PLAN:      { label: "Floor Plan",      color: "text-green-700",  bg: "bg-green-600",  light: "bg-green-50 border-green-200 text-green-700", icon: FileText },
  VIRTUAL_STAGING: { label: "Virtual Staging", color: "text-pink-700",   bg: "bg-pink-600",   light: "bg-pink-50 border-pink-200 text-pink-700",   icon: Layers },
  TWILIGHT:        { label: "Twilight",        color: "text-indigo-700", bg: "bg-indigo-600", light: "bg-indigo-50 border-indigo-200 text-indigo-700", icon: Sunset },
  SOCIAL_MEDIA:    { label: "Social Media",    color: "text-amber-700",  bg: "bg-amber-600",  light: "bg-amber-50 border-amber-200 text-amber-700", icon: Share2 },
  RUSH_EDITING:    { label: "Rush Editing",    color: "text-orange-700", bg: "bg-orange-600", light: "bg-orange-50 border-orange-200 text-orange-700", icon: Zap },
  OTHER:           { label: "Other",           color: "text-gray-700",   bg: "bg-gray-500",   light: "bg-gray-50 border-gray-200 text-gray-700",   icon: HelpCircle },
};

const BADGE_COLOR_OPTIONS = [
  { value: "#f59e0b", label: "Amber" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#10b981", label: "Green" },
  { value: "#ef4444", label: "Red" },
  { value: "#0891b2", label: "Cyan" },
  { value: "#1f2937", label: "Dark" },
];

/* ─── Types ─────────────────────────────────────────────────────────── */
type Service = {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  durationMins: number;
  turnaroundHours?: number | null;
  isActive: boolean;
  description?: string | null;
  coverImage?: string | null;
};

type Package = {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  coverImage?: string | null;
  isActive: boolean;
  isPopular: boolean;
  badgeLabel?: string | null;
  badgeColor?: string | null;
  photoCount?: number | null;
  turnaroundDays?: number | null;
  turnaroundHours?: number | null;
  items: Array<{ serviceId: string; quantity: number; service: Service }>;
  _count: { jobs: number };
};

// ── Client-side image compression ───────────────────────────────────────
async function compressImage(file: File, maxWidth = 1200, maxHeight = 900, quality = 0.85): Promise<File> {
  if (file.size <= 1.5 * 1024 * 1024) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
      }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/* ─── Inline image upload thumbnail (for compact rows) ────────────── */
function InlineImageUpload({
  currentImage,
  onUpload,
  onRemove,
  accentBg,
  accentIcon: AccentIcon,
  stockUrl,
}: {
  currentImage?: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => void;
  accentBg?: string;
  accentIcon?: React.ElementType;
  stockUrl?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { await onUpload(file); } finally { setUploading(false); }
    e.target.value = "";
  }

  const isVideo = currentImage && /\.(mp4|webm|mov)$/i.test(currentImage);

  return (
    <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 group/img cursor-pointer" onClick={() => inputRef.current?.click()}>
      {uploading ? (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
        </div>
      ) : currentImage ? (
        <>
          {isVideo ? (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              <Play className="w-3 h-3 text-white" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentImage} alt="" className="w-full h-full object-cover" />
          )}
          {/* Hover overlay: change or remove */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
            <Upload className="w-3 h-3 text-white" />
          </div>
          {/* Remove button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity z-10"
          >
            <X className="w-2 h-2" />
          </button>
        </>
      ) : stockUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={stockUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
            <Upload className="w-3 h-3 text-white" />
          </div>
        </>
      ) : (
        <>
          {accentBg && AccentIcon ? (
            <div className={cn("w-full h-full flex items-center justify-center", accentBg)}>
              <AccentIcon className="h-3.5 w-3.5 text-white" />
            </div>
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <ImageIcon className="w-3.5 h-3.5 text-gray-300" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
            <Upload className="w-3 h-3 text-white" />
          </div>
        </>
      )}
      <input ref={inputRef} type="file" accept="image/*,video/mp4,video/webm" className="hidden" onChange={handleFile} />
    </div>
  );
}

/* ─── Small reusable badge ──────────────────────────────────────────── */
function PackageBadge({ pkg }: { pkg: Pick<Package, "badgeLabel" | "badgeColor" | "isPopular"> }) {
  if (pkg.badgeLabel) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full text-white shadow-sm"
        style={{ backgroundColor: pkg.badgeColor ?? "#f59e0b" }}
      >
        {pkg.badgeLabel}
      </span>
    );
  }
  if (pkg.isPopular) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300 px-2.5 py-1 rounded-full">
        <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> Most Popular
      </span>
    );
  }
  return null;
}

/* ════════════════════════════════════════════════════════════════════ */
export function PackagesView({ compact = false, filterTerritoryId, formId }: { compact?: boolean; filterTerritoryId?: string; formId?: string } = {}) {
  const [activeTab, setActiveTab] = useState<"services" | "packages" | "brokerage">("services");
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);

  /* ── Service form ── */
  const [serviceName, setServiceName] = useState("");
  const [serviceCategory, setServiceCategory] = useState("PHOTOGRAPHY");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceDuration, setServiceDuration] = useState("60");
  const [serviceTurnaroundHours, setServiceTurnaroundHours] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceCoverImage, setServiceCoverImage] = useState("");
  const [serviceImageUploading, setServiceImageUploading] = useState(false);
  const [serviceTerritoryIds, setServiceTerritoryIds] = useState<string[]>([]);
  const [serviceFormIds, setServiceFormIds] = useState<string[]>([]);

  /* ── Package form ── */
  const [packageName, setPackageName] = useState("");
  const [packagePrice, setPackagePrice] = useState("");
  const [packageDescription, setPackageDescription] = useState("");
  const [packageCoverImage, setPackageCoverImage] = useState("");
  const [packageImageUploading, setPackageImageUploading] = useState(false);
  const [packageIsPopular, setPackageIsPopular] = useState(false);
  const [packageBadgeLabel, setPackageBadgeLabel] = useState("");
  const [packageBadgeColor, setPackageBadgeColor] = useState("#f59e0b");
  const [packagePhotoCount, setPackagePhotoCount] = useState("");
  const [packageTurnaroundHours, setPackageTurnaroundHours] = useState("");
  const [packageDurationMins, setPackageDurationMins] = useState("");
  const [packageServices, setPackageServices] = useState<Array<{ serviceId: string; quantity: number }>>([]);
  const [packageTerritoryIds, setPackageTerritoryIds] = useState<string[]>([]);
  const [packageFormIds, setPackageFormIds] = useState<string[]>([]);

  /* ── Queries ── */
  const { data: services, isLoading: servicesLoading, refetch: refetchServices } = trpc.packages.listServices.useQuery({});
  const { data: packages, isLoading: packagesLoading, refetch: refetchPackages } = trpc.packages.listPackages.useQuery({});
  const { data: territories } = trpc.territories.list.useQuery();
  const { data: orderForms } = trpc.orderForm.list.useQuery();

  /* ── Territory + form filter ── */
  const filteredServices = (services as Service[] | undefined)?.filter((s) => {
    if (filterTerritoryId) {
      const tIds = (s as any).territoryIds as string[] | null | undefined;
      if (tIds && tIds.length > 0 && !tIds.includes(filterTerritoryId)) return false;
    }
    if (formId) {
      const fIds = (s as any).formIds as string[] | null | undefined;
      if (fIds && fIds.length > 0 && !fIds.includes(formId)) return false;
    }
    return true;
  });
  const filteredPackages = (packages as Package[] | undefined)?.filter((p) => {
    if (filterTerritoryId) {
      const tIds = (p as any).territoryIds as string[] | null | undefined;
      if (tIds && tIds.length > 0 && !tIds.includes(filterTerritoryId)) return false;
    }
    if (formId) {
      const fIds = (p as any).formIds as string[] | null | undefined;
      if (fIds && fIds.length > 0 && !fIds.includes(formId)) return false;
    }
    return true;
  });

  /* ── Mutations ── */
  const createServiceMutation = trpc.packages.createService.useMutation();
  const updateServiceMutation = trpc.packages.updateService.useMutation();
  const deleteServiceMutation = trpc.packages.deleteService.useMutation();
  const createPackageMutation = trpc.packages.createPackage.useMutation();
  const updatePackageMutation = trpc.packages.updatePackage.useMutation();
  const deletePackageMutation = trpc.packages.deletePackage.useMutation();

  /* ── Delete confirmation state (id pending confirmation) ── */
  const [confirmDeleteServiceId, setConfirmDeleteServiceId] = useState<string | null>(null);
  const [confirmDeletePackageId, setConfirmDeletePackageId] = useState<string | null>(null);

  /* ── Helpers ── */
  const resetServiceForm = () => {
    setServiceName(""); setServicePrice(""); setServiceCategory("PHOTOGRAPHY");
    setServiceDuration("60"); setServiceTurnaroundHours(""); setServiceDescription("");
    setServiceCoverImage(""); setServiceTerritoryIds([]); setServiceFormIds(formId ? [formId] : []);
    setEditingService(null); setShowServiceModal(false);
  };

  const handleOpenEditService = (service: Service) => {
    setEditingService(service);
    setServiceName(service.name);
    setServiceCategory(service.category);
    setServicePrice(String(service.basePrice));
    setServiceDuration(String(service.durationMins));
    setServiceTurnaroundHours(service.turnaroundHours ? String(service.turnaroundHours) : "");
    setServiceDescription(service.description ?? "");
    setServiceCoverImage(service.coverImage ?? "");
    setServiceTerritoryIds(((service as any).territoryIds as string[]) ?? []);
    setServiceFormIds(((service as any).formIds as string[]) ?? (formId ? [formId] : []));
    setShowServiceModal(true);
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName || !servicePrice) return;
    setIsSubmitting(true);
    try {
      if (editingService) {
        await updateServiceMutation.mutateAsync({
          id: editingService.id,
          name: serviceName,
          category: serviceCategory as any,
          basePrice: parseFloat(servicePrice),
          durationMins: parseInt(serviceDuration),
          turnaroundHours: serviceTurnaroundHours ? parseInt(serviceTurnaroundHours) : null,
          description: serviceDescription || undefined,
          coverImage: serviceCoverImage || null,
          territoryIds: serviceTerritoryIds.length > 0 ? serviceTerritoryIds : null,
          formIds: serviceFormIds.length > 0 ? serviceFormIds : null,
        });
      } else {
        await createServiceMutation.mutateAsync({
          name: serviceName,
          category: serviceCategory as any,
          basePrice: parseFloat(servicePrice),
          durationMins: parseInt(serviceDuration),
          turnaroundHours: serviceTurnaroundHours ? parseInt(serviceTurnaroundHours) : undefined,
          description: serviceDescription || undefined,
          coverImage: serviceCoverImage || null,
          isActive: true,
          territoryIds: serviceTerritoryIds.length > 0 ? serviceTerritoryIds : undefined,
          formIds: serviceFormIds.length > 0 ? serviceFormIds : undefined,
        });
      }
      resetServiceForm();
      await refetchServices();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleServiceActive = async (id: string, isActive: boolean) => {
    try {
      await updateServiceMutation.mutateAsync({ id, isActive: !isActive });
      await refetchServices();
    } catch (error) {
      console.error("Failed to toggle service:", error);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (confirmDeleteServiceId !== id) {
      setConfirmDeleteServiceId(id);
      setTimeout(() => setConfirmDeleteServiceId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    setConfirmDeleteServiceId(null);
    try {
      await deleteServiceMutation.mutateAsync({ id });
      await refetchServices();
    } catch (error: any) {
      console.error("Failed to delete service:", error);
      alert(error?.message ?? "Failed to delete service. Please try again.");
    }
  };

  const handleDeletePackage = async (id: string) => {
    if (confirmDeletePackageId !== id) {
      setConfirmDeletePackageId(id);
      setTimeout(() => setConfirmDeletePackageId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    setConfirmDeletePackageId(null);
    try {
      await deletePackageMutation.mutateAsync({ id });
      await refetchPackages();
    } catch (error: any) {
      console.error("Failed to delete package:", error);
      alert(error?.message ?? "Failed to delete package. Please try again.");
    }
  };

  const handleOpenEditPackage = (pkg: Package) => {
    setEditingPackage(pkg);
    setPackageName(pkg.name);
    setPackagePrice(String(pkg.price));
    setPackageDescription(pkg.description ?? "");
    setPackageCoverImage(pkg.coverImage ?? "");
    setPackageIsPopular(pkg.isPopular);
    setPackageBadgeLabel(pkg.badgeLabel ?? "");
    setPackageBadgeColor(pkg.badgeColor ?? "#f59e0b");
    setPackagePhotoCount(pkg.photoCount ? String(pkg.photoCount) : "");
    setPackageTurnaroundHours(pkg.turnaroundHours ? String(pkg.turnaroundHours) : "");
    setPackageDurationMins((pkg as any).durationMins ? String((pkg as any).durationMins) : "");
    setPackageServices(pkg.items.map((item) => ({ serviceId: item.serviceId, quantity: item.quantity })));
    setPackageTerritoryIds(((pkg as any).territoryIds as string[]) ?? []);
    setPackageFormIds(((pkg as any).formIds as string[]) ?? (formId ? [formId] : []));
    setShowPackageModal(true);
  };

  const resetPackageForm = () => {
    setEditingPackage(null);
    setShowPackageModal(false);
    setPackageName(""); setPackagePrice(""); setPackageDescription(""); setPackageCoverImage("");
    setPackageIsPopular(false); setPackageBadgeLabel(""); setPackageBadgeColor("#f59e0b");
    setPackagePhotoCount(""); setPackageTurnaroundHours(""); setPackageDurationMins(""); setPackageServices([]);
    setPackageTerritoryIds([]); setPackageFormIds(formId ? [formId] : []);
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageName || !packagePrice || packageServices.length === 0) return;
    setIsSubmitting(true);
    try {
      if (editingPackage) {
        await updatePackageMutation.mutateAsync({
          id: editingPackage.id,
          name: packageName,
          price: parseFloat(packagePrice),
          description: packageDescription || undefined,
          coverImage: packageCoverImage || null,
          isPopular: packageIsPopular,
          badgeLabel: packageBadgeLabel || null,
          badgeColor: packageBadgeLabel ? packageBadgeColor : null,
          photoCount: packagePhotoCount ? parseInt(packagePhotoCount) : null,
          durationMins: packageDurationMins ? parseInt(packageDurationMins) : null,
          turnaroundHours: packageTurnaroundHours ? parseInt(packageTurnaroundHours) : null,
          territoryIds: packageTerritoryIds.length > 0 ? packageTerritoryIds : null,
          formIds: packageFormIds.length > 0 ? packageFormIds : null,
          items: packageServices,
        });
      } else {
        await createPackageMutation.mutateAsync({
          name: packageName,
          price: parseFloat(packagePrice),
          description: packageDescription || undefined,
          coverImage: packageCoverImage || null,
          isActive: true,
          isPopular: packageIsPopular,
          badgeLabel: packageBadgeLabel || undefined,
          badgeColor: packageBadgeLabel ? packageBadgeColor : undefined,
          photoCount: packagePhotoCount ? parseInt(packagePhotoCount) : undefined,
          durationMins: packageDurationMins ? parseInt(packageDurationMins) : undefined,
          turnaroundHours: packageTurnaroundHours ? parseInt(packageTurnaroundHours) : undefined,
          territoryIds: packageTerritoryIds.length > 0 ? packageTerritoryIds : undefined,
          formIds: packageFormIds.length > 0 ? packageFormIds : undefined,
          items: packageServices,
        });
      }
      resetPackageForm();
      await refetchPackages();
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Image upload handler (shared for service & package) ── */
  async function handleProductImageUpload(
    file: File,
    setUploading: (v: boolean) => void,
    setImage: (url: string) => void,
  ) {
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append("file", compressed);
      fd.append("type", "service");
      fd.append("productId", "new"); // "new" skips ownership check; URL saved via tRPC
      const res = await fetch("/api/product/image-upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { alert("Upload failed: " + (json.error ?? "Unknown error")); return; }
      if (json.coverImage) setImage(json.coverImage);
    } catch (err) {
      console.error("Image upload failed:", err);
      alert("Image upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  /* ── Live service card preview ── */
  const cat = CATEGORY_META[serviceCategory] ?? CATEGORY_META.OTHER;
  const CatIcon = cat.icon;
  const servicePreview = (
    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white">
      {/* Color banner */}
      <div className={cn("h-2 w-full", cat.bg)} />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-gray-900 leading-tight">{serviceName || "Service Name"}</p>
            {serviceDescription && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{serviceDescription}</p>
            )}
          </div>
          <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border shrink-0", cat.light)}>
            <CatIcon className="h-3 w-3" />
            {cat.label}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{serviceDuration || "60"} min</span>
          {serviceTurnaroundHours && (
            <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{serviceTurnaroundHours}h turnaround</span>
          )}
        </div>
        <div className="pt-2 border-t flex items-center justify-between">
          <span className="font-bold text-gray-900">{servicePrice ? formatCurrency(parseFloat(servicePrice)) : "$0.00"}</span>
          <span className="text-[10px] font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
        </div>
      </div>
    </div>
  );

  /* ── Live package card preview ── */
  const selectedServiceObjects = (services as Service[] | undefined)?.filter(
    (s) => packageServices.some((ps) => ps.serviceId === s.id)
  ) ?? [];
  const packagePreview = (
    <div className="rounded-xl border-2 border-gray-200 overflow-hidden shadow-md bg-white">
      <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="font-bold text-gray-900 leading-tight">{packageName || "Package Name"}</p>
            {packageDescription && (
              <p className="text-xs text-gray-500 line-clamp-2">{packageDescription}</p>
            )}
          </div>
          <PackageBadge pkg={{ badgeLabel: packageBadgeLabel || null, badgeColor: packageBadgeColor, isPopular: packageIsPopular }} />
        </div>
        {selectedServiceObjects.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedServiceObjects.map((s) => {
              const m = CATEGORY_META[s.category] ?? CATEGORY_META.OTHER;
              const I = m.icon;
              return (
                <span key={s.id} className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border", m.light)}>
                  <I className="h-2.5 w-2.5" />{s.name}
                </span>
              );
            })}
          </div>
        )}
        <div className="pt-2 border-t flex items-center justify-between">
          <div>
            <span className="text-xl font-bold text-gray-900">{packagePrice ? formatCurrency(parseFloat(packagePrice)) : "$0.00"}</span>
            {packageDurationMins && (
              <p className="text-[10px] text-emerald-500 mt-0.5 flex items-center gap-1 font-medium">
                <Timer className="h-3 w-3" />{parseInt(packageDurationMins) >= 60
                  ? `${Math.floor(parseInt(packageDurationMins) / 60)}h${parseInt(packageDurationMins) % 60 > 0 ? ` ${parseInt(packageDurationMins) % 60}m` : ""}`
                  : `${packageDurationMins}m`
                } shoot
              </p>
            )}
            {packageTurnaroundHours && (
              <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                <Timer className="h-3 w-3" />{packageTurnaroundHours}h turnaround
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  /* ══════════════════════ RENDER ══════════════════════════════════════ */
  return (
    <div className="space-y-4">

      {/* ── Tab bar ── */}
      <div className="flex gap-1 border-b">
        {([
          { id: "services", label: "Services" },
          { id: "packages", label: "Packages" },
          { id: "brokerage", label: "Brokerage Groups" },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "font-medium border-b-2 -mb-px transition-colors",
              compact ? "px-2.5 py-2 text-xs" : "px-4 py-3 text-sm",
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════ SERVICES TAB ══════════════════════════════════════ */}
      {activeTab === "services" && (
        <div className={compact ? "space-y-2" : "space-y-4"}>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => {
              setEditingService(null); setServiceName(""); setServicePrice("");
              setServiceCategory("PHOTOGRAPHY"); setServiceDuration("60");
              setServiceDescription(""); setServiceTurnaroundHours("");
              setShowServiceModal(true);
            }}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Service
            </Button>
          </div>

          {servicesLoading ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <p className="text-gray-500">Loading services...</p>
            </div>
          ) : !filteredServices || filteredServices.length === 0 ? (
            <div className="bg-white rounded-xl border flex flex-col items-center justify-center py-10 text-center">
              <Camera className="h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-700">{filterTerritoryId ? "No services for this territory" : "No services yet"}</p>
              <p className="text-xs text-muted-foreground mt-1">{filterTerritoryId ? "Add a territory to a service in its edit form." : "Create your first service to get started."}</p>
            </div>
          ) : compact ? (
            /* ── Compact list view for form designer ── */
            <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
              {(filteredServices as Service[]).map((service) => {
                const meta = CATEGORY_META[service.category] ?? CATEGORY_META.OTHER;
                const Icon = meta.icon;
                return (
                  <div key={service.id} className="flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-gray-50 transition-colors group">
                    <InlineImageUpload
                      currentImage={service.coverImage}
                      accentBg={meta.bg}
                      accentIcon={Icon}
                      stockUrl={!service.coverImage ? getEffectiveCover(null, service.category).url : undefined}
                      onUpload={async (file) => {
                        const compressed = await compressImage(file);
                        const fd = new FormData();
                        fd.append("file", compressed);
                        fd.append("type", "service");
                        fd.append("productId", service.id);
                        const res = await fetch("/api/product/image-upload", { method: "POST", body: fd });
                        const json = await res.json();
                        if (res.ok && json.coverImage) {
                          await updateServiceMutation.mutateAsync({ id: service.id, coverImage: json.coverImage });
                          refetchServices();
                        }
                      }}
                      onRemove={async () => {
                        await updateServiceMutation.mutateAsync({ id: service.id, coverImage: null });
                        refetchServices();
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900 truncate">{service.name}</p>
                      <p className="text-[10px] text-gray-400">{meta.label} · {service.durationMins} min</p>
                    </div>
                    <span className="text-xs font-bold text-gray-900 shrink-0">{formatCurrency(service.basePrice)}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => handleOpenEditService(service)} className="p-1 hover:bg-gray-200 rounded transition-colors" title="Edit">
                        <Pencil className="h-3 w-3 text-gray-400" />
                      </button>
                      <button onClick={() => handleToggleServiceActive(service.id, service.isActive)} className="p-1 hover:bg-gray-200 rounded transition-colors" title={service.isActive ? "Deactivate" : "Activate"}>
                        {service.isActive ? <ToggleRight className="h-3.5 w-3.5 text-green-500" /> : <ToggleLeft className="h-3.5 w-3.5 text-gray-400" />}
                      </button>
                      {confirmDeleteServiceId === service.id ? (
                        <button onClick={() => handleDeleteService(service.id)} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded text-[10px] font-semibold transition-colors" title="Confirm delete">
                          Delete?
                        </button>
                      ) : (
                        <button onClick={() => handleDeleteService(service.id)} className="p-1 hover:bg-red-50 rounded transition-colors" title="Delete">
                          <Trash2 className="h-3 w-3 text-gray-300 hover:text-red-400" />
                        </button>
                      )}
                    </div>
                    {!service.isActive && <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">Off</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(filteredServices as Service[]).map((service) => {
                const meta = CATEGORY_META[service.category] ?? CATEGORY_META.OTHER;
                const Icon = meta.icon;
                return (
                  <div key={service.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                    {/* Cover image / video / stock fallback */}
                    {(() => {
                      const cover = getEffectiveCover(service.coverImage, service.category);
                      return cover.isVideo ? (
                        <video src={cover.url} className="w-full h-32 object-cover" muted autoPlay loop playsInline />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover.url} alt={service.name} className="w-full h-32 object-cover" />
                      );
                    })()}
                    <div className="p-4 space-y-3">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 leading-tight truncate">{service.name}</p>
                          {service.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{service.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => handleOpenEditService(service)}
                            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5 text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleToggleServiceActive(service.id, service.isActive)}
                            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                            title={service.isActive ? "Deactivate" : "Activate"}
                          >
                            {service.isActive
                              ? <ToggleRight className="h-4 w-4 text-green-500" />
                              : <ToggleLeft className="h-4 w-4 text-gray-400" />}
                          </button>
                          {confirmDeleteServiceId === service.id ? (
                            <button onClick={() => handleDeleteService(service.id)} className="flex items-center gap-0.5 px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md text-[10px] font-semibold transition-colors">
                              Delete?
                            </button>
                          ) : (
                            <button onClick={() => handleDeleteService(service.id)} className="p-1.5 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                              <Trash2 className="h-3.5 w-3.5 text-gray-300 hover:text-red-400" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Category chip + stats */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border", meta.light)}>
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-gray-500">
                          <Clock className="h-3 w-3" />{service.durationMins} min
                        </span>
                        {service.turnaroundHours && (
                          <span className="flex items-center gap-1 text-[11px] text-gray-500">
                            <Timer className="h-3 w-3" />{service.turnaroundHours}h
                          </span>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between">
                        <span className="font-bold text-gray-900">{formatCurrency(service.basePrice)}</span>
                        <span className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          service.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        )}>
                          {service.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════ PACKAGES TAB ══════════════════════════════════════ */}
      {activeTab === "packages" && (
        <div className={compact ? "space-y-2" : "space-y-4"}>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setEditingPackage(null); resetPackageForm(); setShowPackageModal(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Package
            </Button>
          </div>

          {packagesLoading ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <p className="text-gray-500">Loading packages...</p>
            </div>
          ) : !filteredPackages || filteredPackages.length === 0 ? (
            <div className="bg-white rounded-xl border flex flex-col items-center justify-center py-10 text-center">
              <Boxes className="h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-700">{filterTerritoryId ? "No packages for this territory" : "No packages yet"}</p>
              <p className="text-xs text-muted-foreground mt-1">{filterTerritoryId ? "Add a territory to a package in its edit form." : "Create your first package to bundle services."}</p>
            </div>
          ) : compact ? (
            /* ── Compact list view for form designer ── */
            <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
              {(filteredPackages as Package[]).map((pkg) => (
                <div key={pkg.id} className="px-3 py-2.5 bg-white hover:bg-gray-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <InlineImageUpload
                      currentImage={pkg.coverImage}
                      stockUrl={!pkg.coverImage ? getEffectiveCover(null, pkg.items?.[0]?.service?.category ?? "PHOTOGRAPHY").url : undefined}
                      onUpload={async (file) => {
                        const compressed = await compressImage(file);
                        const fd = new FormData();
                        fd.append("file", compressed);
                        fd.append("type", "package");
                        fd.append("productId", pkg.id);
                        const res = await fetch("/api/product/image-upload", { method: "POST", body: fd });
                        const json = await res.json();
                        if (res.ok && json.coverImage) {
                          await updatePackageMutation.mutateAsync({ id: pkg.id, coverImage: json.coverImage });
                          refetchPackages();
                        }
                      }}
                      onRemove={async () => {
                        await updatePackageMutation.mutateAsync({ id: pkg.id, coverImage: null });
                        refetchPackages();
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-gray-900 truncate">{pkg.name}</p>
                        <PackageBadge pkg={pkg} />
                      </div>
                      {pkg.items.length > 0 && (
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                          {pkg.items.map((item) => item.service.name).join(" · ")}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-bold text-gray-900 shrink-0">{formatCurrency(pkg.price)}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => handleOpenEditPackage(pkg)} className="p-1 hover:bg-gray-200 rounded transition-colors" title="Edit">
                        <Pencil className="h-3 w-3 text-gray-400" />
                      </button>
                      {confirmDeletePackageId === pkg.id ? (
                        <button onClick={() => handleDeletePackage(pkg.id)} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded text-[10px] font-semibold transition-colors" title="Confirm delete">
                          Delete?
                        </button>
                      ) : (
                        <button onClick={() => handleDeletePackage(pkg.id)} className="p-1 hover:bg-red-50 rounded transition-colors" title="Delete">
                          <Trash2 className="h-3 w-3 text-gray-300 hover:text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(filteredPackages as Package[]).map((pkg) => (
                <div key={pkg.id} className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm hover:shadow-md hover:border-blue-200 transition-all group">
                  {/* Cover image / video / stock fallback */}
                  {(() => {
                    const firstCat = pkg.items?.[0]?.service?.category ?? "PHOTOGRAPHY";
                    const cover = getEffectiveCover(pkg.coverImage, firstCat);
                    return cover.isVideo ? (
                      <video src={cover.url} className="w-full h-36 object-cover" muted autoPlay loop playsInline />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover.url} alt={pkg.name} className="w-full h-36 object-cover" />
                    );
                  })()}
                  <div className="p-4 space-y-3">
                    {/* Name + badge row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-900 leading-tight">{pkg.name}</h3>
                          <PackageBadge pkg={pkg} />
                        </div>
                        {pkg.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{pkg.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => handleOpenEditPackage(pkg)} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors" title="Edit">
                          <Pencil className="h-3.5 w-3.5 text-gray-400" />
                        </button>
                        {confirmDeletePackageId === pkg.id ? (
                          <button onClick={() => handleDeletePackage(pkg.id)} className="flex items-center gap-0.5 px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md text-[10px] font-semibold transition-colors">
                            Delete?
                          </button>
                        ) : (
                          <button onClick={() => handleDeletePackage(pkg.id)} className="p-1.5 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                            <Trash2 className="h-3.5 w-3.5 text-gray-300 hover:text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Included services */}
                    {pkg.items.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {pkg.items.map((item) => {
                          const m = CATEGORY_META[item.service.category] ?? CATEGORY_META.OTHER;
                          const I = m.icon;
                          return (
                            <span key={item.serviceId} className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border", m.light)}>
                              <I className="h-2.5 w-2.5" />
                              {item.service.name}
                              {item.quantity > 1 && <span className="opacity-60">×{item.quantity}</span>}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(pkg.price)}</p>
                        {(pkg as any).durationMins && (
                          <p className="text-[10px] text-emerald-500 flex items-center gap-1 mt-0.5 font-medium">
                            <Timer className="h-3 w-3" />
                            {(pkg as any).durationMins >= 60
                              ? `${Math.floor((pkg as any).durationMins / 60)}h${(pkg as any).durationMins % 60 > 0 ? ` ${(pkg as any).durationMins % 60}m` : ""}`
                              : `${(pkg as any).durationMins}m`
                            } shoot
                          </p>
                        )}
                        {(pkg.turnaroundHours || pkg.turnaroundDays) && (
                          <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <Timer className="h-3 w-3" />
                            {pkg.turnaroundHours ? `${pkg.turnaroundHours}h` : `${pkg.turnaroundDays}d`} turnaround
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">{pkg._count.jobs} jobs</p>
                        <span className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          pkg.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        )}>
                          {pkg.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════ BROKERAGE GROUPS TAB ══════════════════════════════ */}
      {activeTab === "brokerage" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <Building2 className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              Brokerage pricing groups let you offer automatic discounts to clients from specific brokerages or corporate accounts.
            </p>
          </div>
          <BrokerageGroupsManager />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
           ADD / EDIT SERVICE MODAL  — wide two-column layout
         ══════════════════════════════════════════════════════════════ */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editingService ? "Edit Service" : "Add Service"}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Fill in the details — a live preview updates on the right.</p>
              </div>
              <button onClick={resetServiceForm} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {/* Body — two columns */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-0">

                {/* Left: form */}
                <form id="service-form" onSubmit={handleCreateService} className="sm:col-span-3 p-6 space-y-4 border-r">

                  {/* Service Name + Category — merged */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Service Name <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 mb-2.5">
                      {Object.entries(CATEGORY_META).map(([key, meta]) => {
                        const Icon = meta.icon;
                        const selected = serviceCategory === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setServiceCategory(key);
                              // Auto-fill name if blank or still matches a category label
                              const currentIsCategory = Object.values(CATEGORY_META).some(
                                (m) => m.label === serviceName
                              );
                              if (!serviceName || currentIsCategory) {
                                setServiceName(meta.label);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs font-medium transition-all",
                              selected
                                ? `${meta.light} border-current shadow-sm`
                                : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                            )}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            {meta.label}
                            {selected && <CheckCircle2 className="h-3 w-3 ml-auto shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    <Input value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="or type a custom name…" disabled={isSubmitting} className="h-10" />
                  </div>

                  {/* Price + Duration */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Base Price <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <Input type="number" step="0.01" min="0" value={servicePrice} onChange={(e) => setServicePrice(e.target.value)} placeholder="199.99" disabled={isSubmitting} className="h-10 pl-6" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Shoot Duration</label>
                      <div className="relative">
                        <Input type="number" min="15" step="15" value={serviceDuration} onChange={(e) => setServiceDuration(e.target.value)} placeholder="60" disabled={isSubmitting} className="h-10 pr-12" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">min</span>
                      </div>
                    </div>
                  </div>

                  {/* Turnaround */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Turnaround Time <span className="text-gray-400 font-normal">(optional)</span></label>
                    <div className="relative">
                      <Input type="number" min="1" value={serviceTurnaroundHours} onChange={(e) => setServiceTurnaroundHours(e.target.value)} placeholder="e.g. 24" disabled={isSubmitting} className="h-10 pr-14" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">hours</span>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                    <textarea
                      value={serviceDescription}
                      onChange={(e) => setServiceDescription(e.target.value)}
                      placeholder="Briefly describe what's included…"
                      rows={3}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                    />
                  </div>

                  {/* Territory */}
                  {territories && territories.length > 0 && (
                    <div className="rounded-xl border-2 border-blue-100 bg-blue-50 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">Service Location</p>
                          <p className="text-xs text-gray-500">Which territories offer this service?</p>
                        </div>
                        {serviceTerritoryIds.length > 0 && (
                          <span className="ml-auto text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                            {serviceTerritoryIds.length} selected
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {(territories as any[]).map((t) => {
                          const isSelected = serviceTerritoryIds.includes(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setServiceTerritoryIds((prev) => isSelected ? prev.filter((id) => id !== t.id) : [...prev, t.id])}
                              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border-2 transition-all shadow-sm ${
                                isSelected
                                  ? "text-white border-transparent shadow-md scale-105"
                                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:shadow"
                              }`}
                              style={isSelected ? { backgroundColor: t.color || "#3B82F6", borderColor: t.color || "#3B82F6" } : undefined}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.8)" : (t.color || "#3B82F6") }} />
                              {t.name}
                              {isSelected && (
                                <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {serviceTerritoryIds.length === 0 && (
                        <p className="text-[11px] text-blue-400 mt-2.5 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
                          Leave unselected to show in all locations
                        </p>
                      )}
                    </div>
                  )}

                  {/* Form Availability */}
                  {orderForms && orderForms.length > 1 && (
                    <div className="rounded-xl border-2 border-purple-100 bg-purple-50 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center shrink-0">
                          <LayoutTemplate className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">Order Form Availability</p>
                          <p className="text-xs text-gray-500">Which booking forms should show this service?</p>
                        </div>
                        {serviceFormIds.length > 0 && (
                          <span className="ml-auto text-[10px] font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full">
                            {serviceFormIds.length} form{serviceFormIds.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {(orderForms as any[]).map((f) => {
                          const isSelected = serviceFormIds.length === 0 || serviceFormIds.includes(f.id);
                          const isCurrent = f.id === formId;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setServiceFormIds((prev) => {
                                if (prev.length === 0) {
                                  // Was "all forms" — switch to all except this one
                                  return (orderForms as any[]).map((x) => x.id).filter((id) => id !== f.id);
                                }
                                return prev.includes(f.id) ? prev.filter((id) => id !== f.id) : [...prev, f.id];
                              })}
                              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border-2 transition-all shadow-sm ${
                                isSelected
                                  ? "bg-purple-600 text-white border-purple-600 shadow-md scale-105"
                                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:shadow"
                              }`}
                            >
                              {isSelected && (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              {f.title}
                              {isCurrent && <span className="text-[10px] opacity-70">(this form)</span>}
                            </button>
                          );
                        })}
                      </div>
                      {serviceFormIds.length === 0 && (
                        <p className="text-[11px] text-purple-400 mt-2.5 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
                          Showing in all booking forms
                        </p>
                      )}
                    </div>
                  )}

                  {/* Cover Image */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cover Image <span className="text-gray-400 font-normal">(optional)</span></label>
                    {serviceCoverImage ? (
                      <div className="relative group rounded-lg overflow-hidden border border-gray-200">
                        {isVideoUrl(serviceCoverImage) ? (
                          <video src={serviceCoverImage} className="w-full h-28 object-cover" muted autoPlay loop playsInline />
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={serviceCoverImage} alt="Cover" className="w-full h-28 object-cover" />
                        )}
                        <button type="button" onClick={() => setServiceCoverImage("")}
                          className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                        {serviceImageUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        ) : (
                          <>
                            <Upload className="w-4 h-4 text-gray-400 mb-0.5" />
                            <span className="text-[11px] text-gray-500">Upload image</span>
                          </>
                        )}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProductImageUpload(f, setServiceImageUploading, setServiceCoverImage); }} />
                      </label>
                    )}

                    {/* Stock Media Picker */}
                    <div className="mt-2.5">
                      <p className="text-[11px] font-medium text-gray-400 mb-1.5">Or choose from stock media</p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {Object.entries(STOCK_COVERS).map(([cat, media]) => {
                          const meta = CATEGORY_META[cat] ?? CATEGORY_META.OTHER;
                          const isSelected = serviceCoverImage === media.url;
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setServiceCoverImage(isSelected ? "" : media.url)}
                              className={`relative rounded-md overflow-hidden aspect-square border-2 transition-all group/stock ${
                                isSelected ? "border-blue-500 ring-1 ring-blue-500" : "border-transparent hover:border-gray-300"
                              }`}
                              title={meta.label}
                            >
                              {media.type === "video" ? (
                                <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                                  <Play className="w-3 h-3 text-white" />
                                </div>
                              ) : (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={media.url} alt={meta.label} className="w-full h-full object-cover" />
                              )}
                              <div className="absolute inset-x-0 bottom-0 bg-black/60 px-0.5 py-px">
                                <span className="text-[8px] text-white font-medium leading-none block truncate">{meta.label}</span>
                              </div>
                              {isSelected && (
                                <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                  <CheckCircle2 className="w-4 h-4 text-blue-600 drop-shadow" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </form>

                {/* Right: live preview */}
                <div className="sm:col-span-2 p-6 bg-gray-50 flex flex-col gap-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Live Preview</p>
                  {servicePreview}
                  <p className="text-[10px] text-gray-400 text-center">This is how your service card will look.</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button type="button" onClick={resetServiceForm} disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button form="service-form" type="submit" disabled={isSubmitting || !serviceName || !servicePrice}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                {isSubmitting ? (editingService ? "Saving…" : "Creating…") : (editingService ? "Save Changes" : "Create Service")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
           CREATE PACKAGE MODAL  — wide two-column layout
         ══════════════════════════════════════════════════════════════ */}
      {showPackageModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editingPackage ? "Edit Package" : "Create Package"}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Bundle services into a package — preview updates live.</p>
              </div>
              <button onClick={resetPackageForm} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {/* Body — two columns */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-0">

                {/* Left: form */}
                <form id="package-form" onSubmit={handleCreatePackage} className="sm:col-span-3 p-6 space-y-4 border-r">

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Package Name <span className="text-red-500">*</span></label>
                    <Input value={packageName} onChange={(e) => setPackageName(e.target.value)} placeholder="e.g. Premium Package" disabled={isSubmitting} className="h-10" />
                  </div>

                  {/* Price */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Price <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <Input type="number" step="0.01" min="0" value={packagePrice} onChange={(e) => setPackagePrice(e.target.value)} placeholder="999.99" disabled={isSubmitting} className="h-10 pl-6" />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                    <textarea
                      value={packageDescription}
                      onChange={(e) => setPackageDescription(e.target.value)}
                      placeholder="What's included, perfect for…"
                      rows={2}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                    />
                  </div>

                  {/* Duration — blocks calendar time for scheduling */}
                  <div className="rounded-xl border-2 border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                        <Timer className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Shoot Duration</p>
                        <p className="text-xs text-gray-500">How long does this package take on-site?</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="15"
                        step="15"
                        value={packageDurationMins}
                        onChange={(e) => setPackageDurationMins(e.target.value)}
                        placeholder="e.g. 90"
                        disabled={isSubmitting}
                        className="h-10 bg-white flex-1"
                      />
                      <span className="text-sm text-gray-500 font-medium shrink-0">minutes</span>
                    </div>
                    {packageDurationMins && (
                      <p className="text-[11px] text-emerald-600 mt-2 font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M5 13l4 4L19 7"/></svg>
                        Calendar will block {parseInt(packageDurationMins) >= 60
                          ? `${Math.floor(parseInt(packageDurationMins) / 60)}h${parseInt(packageDurationMins) % 60 > 0 ? ` ${parseInt(packageDurationMins) % 60}m` : ""}`
                          : `${packageDurationMins}m`
                        } for each booking
                      </p>
                    )}
                    {!packageDurationMins && (
                      <p className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
                        Without duration, scheduling can&apos;t prevent overlapping bookings
                      </p>
                    )}
                  </div>

                  {/* Territory */}
                  {territories && territories.length > 0 && (
                    <div className="rounded-xl border-2 border-blue-100 bg-blue-50 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">Package Location</p>
                          <p className="text-xs text-gray-500">Which territories offer this package?</p>
                        </div>
                        {packageTerritoryIds.length > 0 && (
                          <span className="ml-auto text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                            {packageTerritoryIds.length} selected
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {(territories as any[]).map((t) => {
                          const isSelected = packageTerritoryIds.includes(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setPackageTerritoryIds((prev) => isSelected ? prev.filter((id) => id !== t.id) : [...prev, t.id])}
                              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border-2 transition-all shadow-sm ${
                                isSelected
                                  ? "text-white border-transparent shadow-md scale-105"
                                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:shadow"
                              }`}
                              style={isSelected ? { backgroundColor: t.color || "#3B82F6", borderColor: t.color || "#3B82F6" } : undefined}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.8)" : (t.color || "#3B82F6") }} />
                              {t.name}
                              {isSelected && (
                                <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {packageTerritoryIds.length === 0 && (
                        <p className="text-[11px] text-blue-400 mt-2.5 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
                          Leave unselected to show in all locations
                        </p>
                      )}
                    </div>
                  )}

                  {/* Form Availability */}
                  {orderForms && orderForms.length > 1 && (
                    <div className="rounded-xl border-2 border-purple-100 bg-purple-50 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center shrink-0">
                          <LayoutTemplate className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">Order Form Availability</p>
                          <p className="text-xs text-gray-500">Which booking forms should show this package?</p>
                        </div>
                        {packageFormIds.length > 0 && (
                          <span className="ml-auto text-[10px] font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full">
                            {packageFormIds.length} form{packageFormIds.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {(orderForms as any[]).map((f) => {
                          const isSelected = packageFormIds.length === 0 || packageFormIds.includes(f.id);
                          const isCurrent = f.id === formId;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setPackageFormIds((prev) => {
                                if (prev.length === 0) {
                                  return (orderForms as any[]).map((x) => x.id).filter((id) => id !== f.id);
                                }
                                return prev.includes(f.id) ? prev.filter((id) => id !== f.id) : [...prev, f.id];
                              })}
                              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border-2 transition-all shadow-sm ${
                                isSelected
                                  ? "bg-purple-600 text-white border-purple-600 shadow-md scale-105"
                                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:shadow"
                              }`}
                            >
                              {isSelected && (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              {f.title}
                              {isCurrent && <span className="text-[10px] opacity-70">(this form)</span>}
                            </button>
                          );
                        })}
                      </div>
                      {packageFormIds.length === 0 && (
                        <p className="text-[11px] text-purple-400 mt-2.5 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
                          Showing in all booking forms
                        </p>
                      )}
                    </div>
                  )}

                  {/* Cover Image */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cover Image <span className="text-gray-400 font-normal">(optional)</span></label>
                    {packageCoverImage ? (
                      <div className="relative group rounded-lg overflow-hidden border border-gray-200">
                        {isVideoUrl(packageCoverImage) ? (
                          <video src={packageCoverImage} className="w-full h-28 object-cover" muted autoPlay loop playsInline />
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={packageCoverImage} alt="Cover" className="w-full h-28 object-cover" />
                        )}
                        <button type="button" onClick={() => setPackageCoverImage("")}
                          className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                        {packageImageUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        ) : (
                          <>
                            <Upload className="w-4 h-4 text-gray-400 mb-0.5" />
                            <span className="text-[11px] text-gray-500">Upload image</span>
                          </>
                        )}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProductImageUpload(f, setPackageImageUploading, setPackageCoverImage); }} />
                      </label>
                    )}

                    {/* Stock Media Picker */}
                    <div className="mt-2.5">
                      <p className="text-[11px] font-medium text-gray-400 mb-1.5">Or choose from stock media</p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {Object.entries(STOCK_COVERS).map(([cat, media]) => {
                          const meta = CATEGORY_META[cat] ?? CATEGORY_META.OTHER;
                          const isSelected = packageCoverImage === media.url;
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setPackageCoverImage(isSelected ? "" : media.url)}
                              className={`relative rounded-md overflow-hidden aspect-square border-2 transition-all group/stock ${
                                isSelected ? "border-blue-500 ring-1 ring-blue-500" : "border-transparent hover:border-gray-300"
                              }`}
                              title={meta.label}
                            >
                              {media.type === "video" ? (
                                <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                                  <Play className="w-3 h-3 text-white" />
                                </div>
                              ) : (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={media.url} alt={meta.label} className="w-full h-full object-cover" />
                              )}
                              <div className="absolute inset-x-0 bottom-0 bg-black/60 px-0.5 py-px">
                                <span className="text-[8px] text-white font-medium leading-none block truncate">{meta.label}</span>
                              </div>
                              {isSelected && (
                                <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                  <CheckCircle2 className="w-4 h-4 text-blue-600 drop-shadow" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Turnaround */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Turnaround Time <span className="text-gray-400 font-normal">(optional)</span></label>
                    <div className="relative">
                      <Input type="number" min="1" value={packageTurnaroundHours} onChange={(e) => setPackageTurnaroundHours(e.target.value)} placeholder="e.g. 48" disabled={isSubmitting} className="h-10 pr-14" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">hours</span>
                    </div>
                  </div>

                  {/* Badge section */}
                  <div className="rounded-xl border border-gray-200 p-3.5 space-y-3 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5 text-gray-400" />
                      <p className="text-sm font-semibold text-gray-700">Badge</p>
                    </div>
                    <Input
                      value={packageBadgeLabel}
                      onChange={(e) => setPackageBadgeLabel(e.target.value)}
                      placeholder="e.g. Most Popular, Best Value, Featured…"
                      disabled={isSubmitting}
                      className="h-9 bg-white"
                    />
                    {packageBadgeLabel && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500">Color:</p>
                        <div className="flex gap-2 flex-wrap">
                          {BADGE_COLOR_OPTIONS.map((opt) => (
                            <button key={opt.value} type="button" onClick={() => setPackageBadgeColor(opt.value)} title={opt.label}
                              className={cn("w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                                packageBadgeColor === opt.value ? "border-gray-800 scale-110" : "border-white shadow")}
                              style={{ backgroundColor: opt.value }}
                            />
                          ))}
                        </div>
                        <span className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full text-white shadow-sm"
                          style={{ backgroundColor: packageBadgeColor }}>
                          {packageBadgeLabel}
                        </span>
                      </div>
                    )}
                    {!packageBadgeLabel && (
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={packageIsPopular} onChange={(e) => setPackageIsPopular(e.target.checked)} disabled={isSubmitting} className="rounded" />
                        <span className="text-sm text-gray-600">Mark as <strong>Most Popular</strong></span>
                      </label>
                    )}
                  </div>

                  {/* Include services */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Include Services <span className="text-red-500">*</span></label>
                    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                      {!services || services.length === 0 ? (
                        <p className="text-xs text-gray-500 p-3">Create services first.</p>
                      ) : (
                        <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                          {(filteredServices as Service[]).map((service) => {
                            const m = CATEGORY_META[service.category] ?? CATEGORY_META.OTHER;
                            const I = m.icon;
                            const checked = packageServices.some((s) => s.serviceId === service.id);
                            return (
                              <label key={service.id} className={cn(
                                "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors",
                                checked ? "bg-blue-50" : "hover:bg-gray-50"
                              )}>
                                <input type="checkbox" checked={checked} onChange={(e) => {
                                  if (e.target.checked) setPackageServices([...packageServices, { serviceId: service.id, quantity: 1 }]);
                                  else setPackageServices(packageServices.filter((s) => s.serviceId !== service.id));
                                }} disabled={isSubmitting} className="rounded text-blue-600" />
                                <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0", m.light)}>
                                  <I className="h-3 w-3" />
                                </span>
                                <span className="text-sm text-gray-700 font-medium">{service.name}</span>
                                <span className="ml-auto text-xs text-gray-400">{formatCurrency(service.basePrice)}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {packageServices.length > 0 && (
                      <p className="text-xs text-blue-600 mt-1 font-medium">{packageServices.length} service{packageServices.length > 1 ? "s" : ""} selected</p>
                    )}
                  </div>
                </form>

                {/* Right: live preview */}
                <div className="sm:col-span-2 p-6 bg-gray-50 flex flex-col gap-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Live Preview</p>
                  {packagePreview}
                  <p className="text-[10px] text-gray-400 text-center">This is how your package card will look.</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button type="button" onClick={resetPackageForm} disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button form="package-form" type="submit" disabled={isSubmitting || !packageName || !packagePrice || packageServices.length === 0}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                {isSubmitting ? (editingPackage ? "Saving..." : "Creating...") : (editingPackage ? "Save Changes" : "Create Package")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
