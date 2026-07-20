"use client";

import { useRef, useState } from "react";
import { Check, Eye, EyeOff, FileCode2, KeyRound, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type EnvironmentVariable = { key: string; value: string; hasValue?: boolean };

type EnvironmentVariableEditorProps = {
  value: EnvironmentVariable[];
  onChange: (variables: EnvironmentVariable[]) => void;
  compact?: boolean;
};

function parseEnv(content: string) {
  return content.split(/\r?\n/).reduce<EnvironmentVariable[]>((variables, rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return variables;
    const normalized = line.startsWith("export ") ? line.slice(7) : line;
    const separator = normalized.indexOf("=");
    if (separator < 1) return variables;
    const key = normalized.slice(0, separator).trim();
    let value = normalized.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return variables;
    variables.push({ key, value });
    return variables;
  }, []);
}

export function EnvironmentVariableEditor({ value, onChange, compact = false }: EnvironmentVariableEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showValues, setShowValues] = useState(false);
  const [importNote, setImportNote] = useState("");

  const variables = value.length ? value : [{ key: "", value: "" }];
  const updateVariable = (index: number, field: "key" | "value", next: string) => onChange(variables.map((variable, itemIndex) => itemIndex === index ? { ...variable, [field]: next, ...(field === "value" ? { hasValue: false } : {}) } : variable));
  const removeVariable = (index: number) => onChange(variables.length === 1 ? [{ key: "", value: "" }] : variables.filter((_, itemIndex) => itemIndex !== index));

  const importVariables = (source: string) => {
    const incoming = parseEnv(source);
    if (!incoming.length) {
      setImportNote("No valid variables found. Use KEY=value lines.");
      return;
    }
    const merged = new Map(value.filter((item) => item.key.trim()).map((item) => [item.key, item]));
    incoming.forEach((item) => merged.set(item.key, item));
    onChange(Array.from(merged.values()));
    setImportNote(`${incoming.length} variable${incoming.length === 1 ? "" : "s"} imported. Existing keys were updated.`);
  };

  return <Card className="overflow-hidden border-border bg-card shadow-none" onPasteCapture={(event) => { const content = event.clipboardData.getData("text"); if (content.includes("=")) { event.preventDefault(); importVariables(content); } }}>
    <CardHeader className="gap-3 border-b border-border bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300"><KeyRound className="size-3.5" /></span><div><CardTitle className="text-sm font-medium">Environment variables</CardTitle><CardDescription className="mt-1 text-xs leading-5">Encrypted values are injected during the build. Paste a full <code className="font-mono text-foreground">.env</code> file anywhere in this panel.</CardDescription></div></div>
      <div className="flex shrink-0 gap-2"><Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload data-icon="inline-start" />Upload .env</Button><Button type="button" size="sm" variant="ghost" onClick={() => setShowValues((visible) => !visible)}>{showValues ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}{showValues ? "Hide" : "Show"}</Button></div>
      <Input ref={fileInputRef} type="file" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (file) importVariables(await file.text()); event.target.value = ""; }} />
    </CardHeader>
    <CardContent className={compact ? "p-4" : "p-5"}>
      <div className="mb-3 flex items-center justify-between gap-3"><p className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Key / value</p><p className="text-[11px] text-muted-foreground">{variables.filter((item) => item.key.trim()).length} configured</p></div>
      <div className="overflow-hidden rounded-lg border border-border"><div className="hidden grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_36px] gap-2 border-b border-border bg-muted/30 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground sm:grid"><span>Key</span><span>Value</span><span /></div><div className="divide-y divide-border">{variables.map((variable, index) => <div key={`${variable.key}-${index}`} className="grid gap-2 p-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_36px] sm:items-center"><Input aria-label={`Environment variable key ${index + 1}`} value={variable.key} onChange={(event) => updateVariable(index, "key", event.target.value)} placeholder="NEXT_PUBLIC_API_URL" className="h-8 rounded-md border-transparent bg-muted/50 font-mono text-xs shadow-none focus-visible:border-input focus-visible:bg-background" /><Input aria-label={`Environment variable value ${index + 1}`} type={showValues ? "text" : "password"} value={variable.value} onChange={(event) => updateVariable(index, "value", event.target.value)} placeholder={variable.hasValue ? "Stored securely — enter to replace" : "https://api.example.com"} className="h-8 rounded-md border-transparent bg-muted/50 font-mono text-xs shadow-none focus-visible:border-input focus-visible:bg-background" /><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${variable.key || "environment variable"}`} onClick={() => removeVariable(index)} className="text-muted-foreground hover:text-destructive"><Trash2 /></Button></div>)}</div></div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><Button type="button" variant="outline" size="sm" onClick={() => onChange([...variables, { key: "", value: "" }])} className="border-dashed"><Plus data-icon="inline-start" />Add variable</Button>{importNote ? <p className="flex items-center gap-1.5 text-xs text-emerald-400"><Check className="size-3.5" />{importNote}</p> : <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileCode2 className="size-3.5" />Supports comments, quoted values, and <code className="font-mono">export</code>.</p>}</div>
    </CardContent>
  </Card>;
}
