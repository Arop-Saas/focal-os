"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { cn, formatCurrency } from "@/lib/utils";
import { Plus, X, ToggleRight, ToggleLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CATEGORY_LABELS: Record<string, string> = {
  PHOTOGRAPHY: "Photography",
  VIDEO: "Video",
  DRONE: "Drone",
  VIRTUAL_TOUR_3D: "3D Virtual Tour",
  FLOOR_PLAN: "Floor Plan",
  VIRTUAL_STAGING: "Virtual Staging",
  TWILIGHT: "Twilight",
  SOCIAL_MEDIA: "Social Media",
  RUSH_EDITING: "Rush Editing",
  OTHER: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  PHOTOGRAPHY: "bg-blue-50 text-blue-700 border-blue-200",
  VIDEO: "bg-purple-50 text-purple-700 border-purple-200",
  DRONE: "bg-red-50 text-red-700 border-red-200",
  VIRTUAL_TOUR_3D: "bg-cyan-50 text-cyan-700 border-cyan-200",
  FLOOR_PLAN: "bg-green-50 text-green-700 border-green-200",
  VIRTUAL_STAGING: "bg-pink-50 text-pink-700 border-pink-200",
  TWILIGHT: "bg-indigo-50 text-indigo-700 border-indigo-200",
  SOCIAL_MEDIA: "bg-amber-50 text-amber-700 border-amber-200",
  RUSH_EDITING: "bg-orange-50 text-orange-700 border-orange-200",
  OTHER: "bg-gray-50 text-gray-700 border-gray-200",
};

type Service = {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  durationMins: number;
  isActive: boolean;
  description?: string | null;
};

type Package = {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  isActive: boolean;
  items: Array<{
    serviceId: string;
    quantity: number;
    service: Service;
  }>;
  _count: { jobs: number };
};

export function PackagesView() {
  const [activeTab, setActiveTab] = useState<"services" | "packages">("services");
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Service form state
  const [serviceName, setServiceName] = useState("");
  const [serviceCategory, setServiceCategory] = useState("PHOTOGRAPHY");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceDuration, setServiceDuration] = useState("60");
  const [serviceDescription, setServiceDescription] = useState("");

  // Package form state
  const [packageName, setPackageName] = useState("");
  const [packagePrice, setPackagePrice] = useState("");
  const [packageDescription, setPackageDescription] = useState("");
  const [packageServices, setPackageServices] = useState<Array<{ serviceId: string; quantity: number }>>([]);

  // Queries
  const { data: services, isLoading: servicesLoading, refetch: refetchServices } = trpc.packages.listServices.useQuery({});
  const { data: packages, isLoading: packagesLoading, refetch: refetchPackages } = trpc.packages.listPackages.useQuery({});

  // Mutations
  const createServiceMutation = trpc.packages.createService.useMutation();
  const updateServiceMutation = trpc.packages.updateService.useMutation();
  const deleteServiceMutation = trpc.packages.deleteService.useMutation();
  const createPackageMutation = trpc.packages.createPackage.useMutation();

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName || !servicePrice) return;

    setIsSubmitting(true);
    try {
      await createServiceMutation.mutateAsync({
        name: serviceName,
        category: serviceCategory as any,
        basePrice: parseFloat(servicePrice),
        durationMins: parseInt(serviceDuration),
        description: serviceDescription || undefined,
        isActive: true,
      });
      setShowServiceModal(false);
      setServiceName("");
      setServicePrice("");
      setServiceCategory("PHOTOGRAPHY");
      setServiceDuration("60");
      setServiceDescription("");
      await refetchServices();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleServiceActive = async (id: string, isActive: boolean) => {
    try {
      await updateServiceMutation.mutateAsync({
        id,
        isActive: !isActive,
      });
      await refetchServices();
    } catch (error) {
      console.error("Failed to toggle service:", error);
    }
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageName || !packagePrice || packageServices.length === 0) return;

    setIsSubmitting(true);
    try {
      await createPackageMutation.mutateAsync({
        name: packageName,
        price: parseFloat(packagePrice),
        description: packageDescription || undefined,
        isActive: true,
        items: packageServices,
      });
      setShowPackageModal(false);
      setPackageName("");
      setPackagePrice("");
      setPackageDescription("");
      setPackageServices([]);
      await refetchPackages();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab("services")}
          className={cn(
            "px-4 py-3 font-medium text-sm border-b-2 -mb-px transition-colors",
            activeTab === "services"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          )}
        >
          Services
        </button>
        <button
          onClick={() => setActiveTab("packages")}
          className={cn(
            "px-4 py-3 font-medium text-sm border-b-2 -mb-px transition-colors",
            activeTab === "packages"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          )}
        >
          Packages
        </button>
      </div>

      {/* Services Tab */}
      {activeTab === "services" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowServiceModal(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Service
            </Button>
          </div>

          {servicesLoading ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <p className="text-gray-500">Loading services...</p>
            </div>
          ) : !services || services.length === 0 ? (
            <div className="bg-white rounded-xl border flex flex-col items-center justify-center py-16 text-center">
              <div className="text-5xl mb-4">🎯</div>
              <p className="text-base font-semibold text-gray-700">No services yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first service to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(services as Service[]).map((service) => (
                <div key={service.id} className="bg-white rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{service.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{service.description}</p>
                    </div>
                    <button
                      onClick={() => handleToggleServiceActive(service.id, service.isActive)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                      {service.isActive ? (
                        <ToggleRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "inline-flex items-center text-[10px] font-semibold px-2 py-1 rounded border",
                        CATEGORY_COLORS[service.category] || "bg-gray-50 text-gray-700 border-gray-200"
                      )}
                    >
                      {CATEGORY_LABELS[service.category] || service.category}
                    </span>
                    <span className="text-xs text-gray-500">{service.durationMins} mins</span>
                  </div>

                  <div className="pt-2 border-t flex items-center justify-between">
                    <p className="font-semibold text-gray-900">{formatCurrency(service.basePrice)}</p>
                    <span className={cn("text-xs font-medium px-2 py-1 rounded", service.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800")}>
                      {service.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Packages Tab */}
      {activeTab === "packages" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowPackageModal(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Package
            </Button>
          </div>

          {packagesLoading ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <p className="text-gray-500">Loading packages...</p>
            </div>
          ) : !packages || packages.length === 0 ? (
            <div className="bg-white rounded-xl border flex flex-col items-center justify-center py-16 text-center">
              <div className="text-5xl mb-4">📦</div>
              <p className="text-base font-semibold text-gray-700">No packages yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first package to bundle services.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(packages as Package[]).map((pkg) => (
                <div key={pkg.id} className="bg-white rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{pkg.description}</p>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {pkg.items.map((item) => (
                          <span
                            key={item.serviceId}
                            className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded border border-gray-200"
                          >
                            {item.service.name} {item.quantity > 1 ? `x${item.quantity}` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(pkg.price)}</p>
                      <p className="text-xs text-gray-500 mt-1">{pkg._count.jobs} jobs</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">Add Service</h2>
              <button
                onClick={() => setShowServiceModal(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateService} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Service Name</label>
                <Input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="Photography"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                <select
                  value={serviceCategory}
                  onChange={(e) => setServiceCategory(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-0"
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Price</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={servicePrice}
                    onChange={(e) => setServicePrice(e.target.value)}
                    placeholder="199.99"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration (mins)</label>
                  <Input
                    type="number"
                    min="15"
                    step="15"
                    value={serviceDuration}
                    onChange={(e) => setServiceDuration(e.target.value)}
                    placeholder="60"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (Optional)</label>
                <Input
                  type="text"
                  value={serviceDescription}
                  onChange={(e) => setServiceDescription(e.target.value)}
                  placeholder="Add a description"
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowServiceModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !serviceName || !servicePrice}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Package Modal */}
      {showPackageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">Create Package</h2>
              <button
                onClick={() => setShowPackageModal(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePackage} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Package Name</label>
                <Input
                  type="text"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  placeholder="Standard Package"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Price</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={packagePrice}
                  onChange={(e) => setPackagePrice(e.target.value)}
                  placeholder="999.99"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (Optional)</label>
                <Input
                  type="text"
                  value={packageDescription}
                  onChange={(e) => setPackageDescription(e.target.value)}
                  placeholder="Add a description"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Include Services</label>
                <div className="space-y-2 border rounded-md p-3 bg-gray-50 max-h-40 overflow-y-auto">
                  {!services || services.length === 0 ? (
                    <p className="text-xs text-gray-500">Create services first</p>
                  ) : (
                    (services as Service[]).map((service) => (
                      <label key={service.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={packageServices.some((s) => s.serviceId === service.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPackageServices([...packageServices, { serviceId: service.id, quantity: 1 }]);
                            } else {
                              setPackageServices(packageServices.filter((s) => s.serviceId !== service.id));
                            }
                          }}
                          disabled={isSubmitting}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700">{service.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPackageModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !packageName || !packagePrice || packageServices.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
