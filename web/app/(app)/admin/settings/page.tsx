"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, LoaderCircle, Pause, Play, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useApiRequest } from "@/hooks/use-api";
import { PlatformSettings } from "@/lib/admin";
import { AdminPageHeader, AdminPageLoading } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AdminSettingsPage() {
  const apiRequest = useApiRequest();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [defaultLimit, setDefaultLimit] = useState("4");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest("GET", "/admin/settings") as PlatformSettings;
      setSettings(result);
      setDefaultLimit(String(result.defaultProjectLimit));
      setUpdatedAt(new Date());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load platform settings");
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    document.title = "Admin settings | Kyte";
    const timer = setTimeout(() => void loadSettings(), 0);
    return () => clearTimeout(timer);
  }, [loadSettings]);

  async function updateSettings(patch: Partial<PlatformSettings>) {
    setSaving(true);
    try {
      const result = await apiRequest("PATCH", "/admin/settings", patch) as PlatformSettings;
      setSettings(result);
      setDefaultLimit(String(result.defaultProjectLimit));
      setUpdatedAt(new Date());
      toast.success("Platform settings updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update platform settings");
    } finally {
      setSaving(false);
    }
  }

  if (!settings && loading) return <AdminPageLoading />;

  return (
    <div className="app-page flex max-w-5xl flex-col gap-8 py-10">
      <AdminPageHeader title="Platform settings" description="Control deployment intake and the default project allowance for accounts without an override." loading={loading} updatedAt={updatedAt} onRefresh={() => void loadSettings()} />

      <Card className="shadow-none">
        <CardHeader className="gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">{settings?.deploymentsPaused ? <Pause /> : <Activity />}</span>
            <div><div className="flex flex-wrap items-center gap-2"><CardTitle>Deployment intake</CardTitle><Badge variant={settings?.deploymentsPaused ? "destructive" : "secondary"}>{settings?.deploymentsPaused ? "Paused" : "Open"}</Badge></div><CardDescription className="mt-2 max-w-xl leading-6">Pausing blocks new manual and webhook deployments. Existing builds continue unless canceled from Admin → Deployments.</CardDescription></div>
          </div>
          <Button variant={settings?.deploymentsPaused ? "default" : "destructive"} disabled={saving} onClick={() => void updateSettings({ deploymentsPaused: !settings?.deploymentsPaused })}>
            {saving ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : settings?.deploymentsPaused ? <Play data-icon="inline-start" /> : <Pause data-icon="inline-start" />}
            {settings?.deploymentsPaused ? "Resume deployments" : "Pause deployments"}
          </Button>
        </CardHeader>
      </Card>

      <Card className="shadow-none">
        <CardHeader><div className="flex items-start gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"><Settings2 /></span><div><CardTitle>Default project allowance</CardTitle><CardDescription className="mt-2">Applied to users without an individual limit override.</CardDescription></div></div></CardHeader>
        <CardContent>
          <form className="flex max-w-sm items-end gap-2" onSubmit={(event) => { event.preventDefault(); void updateSettings({ defaultProjectLimit: Number(defaultLimit) }); }}>
            <label className="flex flex-1 flex-col gap-2 text-sm font-medium" htmlFor="adminDefaultProjectLimit">Projects per account<Input id="adminDefaultProjectLimit" type="number" min={0} max={100} value={defaultLimit} onChange={(event) => setDefaultLimit(event.target.value)} /></label>
            <Button type="submit" disabled={saving || defaultLimit === ""}>Save limit</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
