"use client";

import { useState } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const contactEndpoint = process.env.NEXT_PUBLIC_CONTACT_FORM_ENDPOINT || "https://formsubmit.co/ajax/rudra568433@gmail.com";

export default function ContactForm({ capacityRequest = false }: { capacityRequest?: boolean }) {
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    name: "",
    email: "",
    message: "",
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    const form = event.currentTarget;
    try {
      const response = await fetch(contactEndpoint, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("The contact service did not accept the message");

      setValues({ name: "", email: "", message: "" });
      toast.success("Message sent. We’ll get back to you soon.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the message");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="_captcha" value="false" />
      <input type="hidden" name="_template" value="table" />
      <input type="hidden" name="_subject" value={capacityRequest ? "Kyte capacity request" : "New Kyte contact request"} />
      <input type="text" name="_honey" className="hidden" tabIndex={-1} autoComplete="off" />

      <FieldGroup className="gap-0">
        <Field className="gap-2 border-b border-neutral-800/70 px-5 py-5 sm:px-8">
          <FieldLabel htmlFor="contact-name" className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">Full name</FieldLabel>
          <Input id="contact-name" name="name" required maxLength={120} placeholder="Your name" value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} className="h-auto rounded-none border-0 bg-transparent px-0 py-2 text-sm text-white shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent" />
        </Field>
        <Field className="gap-2 border-b border-neutral-800/70 px-5 py-5 sm:px-8">
          <FieldLabel htmlFor="contact-email" className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">Email address</FieldLabel>
          <Input id="contact-email" name="email" type="email" required maxLength={254} placeholder="you@company.com" value={values.email} onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))} className="h-auto rounded-none border-0 bg-transparent px-0 py-2 text-sm text-white shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent" />
        </Field>
        <Field className="gap-2 border-b border-neutral-800/70 px-5 py-5 sm:px-8">
          <FieldLabel htmlFor="contact-message" className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">Message</FieldLabel>
          <Textarea id="contact-message" name="message" required minLength={10} maxLength={5000} rows={4} placeholder={capacityRequest ? "Tell us about your projects and the capacity you need." : "Tell us how we can help."} value={values.message} onChange={(event) => setValues((current) => ({ ...current, message: event.target.value }))} className="min-h-24 resize-y rounded-none border-0 bg-transparent px-0 py-2 text-sm text-white shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent" />
        </Field>
        <div className="flex justify-center px-5 py-7 sm:px-8">
          <Button type="submit" variant="outline" size="lg" disabled={submitting} className="h-10 min-w-36 border-neutral-800 bg-neutral-900/50 px-5 text-neutral-300 hover:bg-neutral-900 hover:text-white">
            {submitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Send data-icon="inline-start" />}
            {submitting ? "Sending" : "Send message"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
