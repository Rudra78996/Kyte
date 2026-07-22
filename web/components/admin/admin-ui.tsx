"use client";

import Link from "next/link";
import { LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_PAGE_SIZE } from "@/lib/admin";

export function AdminPageHeader({
  description,
  loading,
  onRefresh,
  title,
  updatedAt,
}: {
  description: string;
  loading: boolean;
  onRefresh: () => void;
  title: string;
  updatedAt: Date | null;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <Badge variant="outline"><ShieldCheck />Administrator</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-foreground">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] text-muted-foreground">
          {updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Not refreshed"}
        </span>
        <Button variant="outline" render={<Link href="/dashboard" />}>Workspace</Button>
        <Button onClick={onRefresh} disabled={loading}>
          {loading ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
          Refresh
        </Button>
      </div>
    </header>
  );
}

export function AdminMetricCard({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: typeof ShieldCheck;
  label: string;
  value: number;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader className="flex-row items-start justify-between pb-3">
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="mt-3 text-3xl tracking-[-0.04em]">{value.toLocaleString()}</CardTitle>
        </div>
        <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"><Icon /></span>
      </CardHeader>
      <CardFooter><p className="text-xs text-muted-foreground">{detail}</p></CardFooter>
    </Card>
  );
}

export function AdminDataCard({
  children,
  count,
  description,
  onPageChange,
  page,
  title,
  total,
}: {
  children: React.ReactNode;
  count: number;
  description: string;
  onPageChange: (page: number) => void;
  page: number;
  title: string;
  total: number;
}) {
  const firstRecord = total === 0 ? 0 : page * ADMIN_PAGE_SIZE + 1;
  const lastRecord = Math.min(total, page * ADMIN_PAGE_SIZE + count);
  return (
    <Card className="overflow-hidden shadow-none">
      <CardHeader className="border-b border-border sm:flex-row sm:items-start sm:justify-between">
        <div><CardTitle>{title}</CardTitle><CardDescription className="mt-2">{description}</CardDescription></div>
        <Badge variant="outline">{total} total</Badge>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
      <CardFooter className="justify-between gap-4 border-t border-border bg-muted/20 pt-4">
        <p className="text-xs text-muted-foreground">Records {firstRecord}–{lastRecord} of {total}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => onPageChange(page - 1)}>Previous</Button>
          <Button size="sm" variant="outline" disabled={(page + 1) * ADMIN_PAGE_SIZE >= total} onClick={() => onPageChange(page + 1)}>Next</Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export function AdminEmpty({ description, icon: Icon, title }: { description: string; icon: typeof ShieldCheck; title: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"><Icon /></span>
      <p className="mt-4 text-sm font-medium">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function AdminPageLoading() {
  return (
    <div className="app-page flex max-w-[1600px] flex-col gap-8 py-10">
      <div className="flex flex-col gap-3"><Skeleton className="h-6 w-36" /><Skeleton className="h-10 w-80 max-w-full" /><Skeleton className="h-5 w-[520px] max-w-full" /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32" />)}</div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
