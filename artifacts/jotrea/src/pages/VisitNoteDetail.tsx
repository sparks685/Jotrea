import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { format, parseISO } from "date-fns";
import { ChevronLeft, Check, CheckCircle2, Circle, Plus, Trash2, Tag, Calendar, User, Syringe, Pill, Info, Share2 } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusGate } from "@/components/PlusGate";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useVisitNotes } from "@/hooks/useVisitNotes";
import { useMedication, useCompanionMedications } from "@/hooks/useMedication";
import { getMedicationTrackingId } from "@/utils/medicationDoses";
import type { CabinetMedication, VisitNote, VisitNoteQuestion, VisitNoteFollowUp } from "@/types";

const VISIT_TYPES = ["In-person", "Telehealth", "Phone call", "Other"];

export default function VisitNoteDetail() {
  const params = useParams<{ id?: string }>();
  const isNew = !params.id || params.id === "new";
  const { notes, setNotes } = useVisitNotes();
  const [, setLocation] = useLocation();
  const { medication } = useMedication();
  const { companions } = useCompanionMedications();
  const [storedCabinet] = useLocalStorage<CabinetMedication[]>("jotrea_medication_cabinet", []);
  const cabinet = Array.isArray(storedCabinet)
    ? storedCabinet.filter((item) => typeof item?.cabinetId === "string" && typeof item?.brandName === "string")
    : [];
  const currentTrackingId = medication ? getMedicationTrackingId(medication) : null;

  // Initialize state
  const [note, setNote] = useState<VisitNote>(() => {
    if (!isNew && params.id) {
      const existing = notes.find(n => n.id === params.id);
      if (existing) return existing;
    }
    return {
      id: `vn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      visitDate: format(new Date(), "yyyy-MM-dd"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      providerName: "",
      specialty: "",
      visitType: "",
      reason: "",
      medicationTrackingId: "none",
      beforeVisit: "",
      duringVisit: "",
      afterVisit: "",
      tags: [],
      questions: [],
      followUps: [],
      includeInProviderSummary: false,
    };
  });

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const lastSaved = useRef<VisitNote>(note);
  const initialized = useRef(false);

  useEffect(() => {
    if (!isNew && params.id && !initialized.current) {
      const existing = notes.find(n => n.id === params.id);
      if (existing) {
        setNote(existing);
        lastSaved.current = existing;
        initialized.current = true;
      } else {
        setLocation("/visit-notes"); // not found
      }
    } else if (isNew && !initialized.current) {
      initialized.current = true;
    }
  }, [isNew, params.id, notes, setLocation]);

  // Auto-save
  useEffect(() => {
    if (!initialized.current) return;
    const timer = setTimeout(() => {
      const hasChanges = JSON.stringify(note) !== JSON.stringify(lastSaved.current);
      if (hasChanges) {
        setSaveStatus("saving");
        const updated = { ...note, updatedAt: new Date().toISOString() };
        
        setNotes(prev => {
          const exists = prev.find(p => p.id === updated.id);
          if (exists) {
            return prev.map(p => p.id === updated.id ? updated : p);
          }
          return [...prev, updated];
        });
        
        lastSaved.current = updated;
        setTimeout(() => setSaveStatus("saved"), 600);
      }
    }, 1000); // 1s debounce
    
    return () => clearTimeout(timer);
  }, [note, setNotes]);

  // Clear "saved" status after a while
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (saveStatus === "saved") {
      t = setTimeout(() => setSaveStatus("idle"), 2000);
    }
    return () => { if (t) clearTimeout(t); };
  }, [saveStatus]);

  const updateField = useCallback(<K extends keyof VisitNote>(field: K, value: VisitNote[K]) => {
    setNote(prev => ({ ...prev, [field]: value }));
  }, []);

  const addQuestion = () => {
    const q: VisitNoteQuestion = { id: `q-${Date.now()}`, text: "", discussed: false };
    setNote(prev => ({ ...prev, questions: [...(prev.questions || []), q] }));
  };

  const updateQuestion = (id: string, updates: Partial<VisitNoteQuestion>) => {
    setNote(prev => ({
      ...prev,
      questions: (prev.questions || []).map(q => q.id === id ? { ...q, ...updates } : q)
    }));
  };

  const removeQuestion = (id: string) => {
    setNote(prev => ({
      ...prev,
      questions: (prev.questions || []).filter(q => q.id !== id)
    }));
  };

  const addFollowUp = () => {
    const f: VisitNoteFollowUp = { id: `f-${Date.now()}`, text: "", completed: false };
    setNote(prev => ({ ...prev, followUps: [...(prev.followUps || []), f] }));
  };

  const updateFollowUp = (id: string, updates: Partial<VisitNoteFollowUp>) => {
    setNote(prev => ({
      ...prev,
      followUps: (prev.followUps || []).map(f => f.id === id ? { ...f, ...updates } : f)
    }));
  };

  const removeFollowUp = (id: string) => {
    setNote(prev => ({
      ...prev,
      followUps: (prev.followUps || []).filter(f => f.id !== id)
    }));
  };

  const [tagInput, setTagInput] = useState("");
  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (!note.tags?.includes(newTag)) {
        setNote(prev => ({ ...prev, tags: [...(prev.tags || []), newTag] }));
      }
      setTagInput("");
    }
  };
  const removeTag = (tag: string) => {
    setNote(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tag) }));
  };

  return (
    <PlusGate feature="Visit Notes">
      <div className="flex min-h-screen flex-col bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur border-b border-border px-4 h-14 flex items-center justify-between">
        <button
           type="button"
          className="flex items-center gap-1 text-sm font-medium text-primary hover:bg-primary/10 px-2 py-1.5 rounded-lg -ml-2 transition-colors"
          onClick={() => {
            // Force an immediate save if there are changes before navigating away
            if (JSON.stringify(note) !== JSON.stringify(lastSaved.current)) {
              const updated = { ...note, updatedAt: new Date().toISOString() };
              setNotes(prev => {
                const exists = prev.find(p => p.id === updated.id);
                if (exists) return prev.map(p => p.id === updated.id ? updated : p);
                return [...prev, updated];
              });
            }
            setLocation("/visit-notes");
          }}
          data-testid="button-back-to-notes"
        >
          <ChevronLeft size={20} /> Back
        </button>
        
        <div className="flex items-center text-xs font-medium" data-testid="save-status">
          {saveStatus === "saving" && <span className="text-muted-foreground animate-pulse">Saving...</span>}
          {saveStatus === "saved" && <span className="text-secondary flex items-center gap-1"><Check size={14} /> Saved</span>}
        </div>
      </header>

      <PageContainer className="pb-24 space-y-8 pt-6">
        
        {/* Section 1: Overview */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Visit Details</h2>
          
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-4">
            <div>
              <Label className="text-xs mb-1.5 block text-muted-foreground">Visit Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                <Input 
                  type="date" 
                  className="pl-9 h-11 bg-muted/50 border-transparent rounded-xl"
                  value={note.visitDate}
                  onChange={(e) => updateField("visitDate", e.target.value)}
                  data-testid="input-visit-date"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block text-muted-foreground">Provider Name</Label>
                <Input 
                  placeholder="Dr. Smith"
                  className="h-11 bg-muted/50 border-transparent rounded-xl"
                  value={note.providerName || ""}
                  onChange={(e) => updateField("providerName", e.target.value)}
                  data-testid="input-provider-name"
                />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block text-muted-foreground">Specialty</Label>
                <Input 
                  placeholder="Endocrinology"
                  className="h-11 bg-muted/50 border-transparent rounded-xl"
                  value={note.specialty || ""}
                  onChange={(e) => updateField("specialty", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block text-muted-foreground">Reason for Visit</Label>
              <Input 
                placeholder="Follow-up on dosage, bloodwork review..."
                className="h-11 bg-muted/50 border-transparent rounded-xl"
                value={note.reason || ""}
                onChange={(e) => updateField("reason", e.target.value)}
                data-testid="input-reason"
              />
            </div>

            <div>
              <Label className="text-xs mb-1.5 block text-muted-foreground">Visit Type</Label>
              <Select value={note.visitType || "none"} onValueChange={(val) => updateField("visitType", val === "none" ? "" : val)}>
                <SelectTrigger className="h-11 bg-muted/50 border-transparent rounded-xl">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="none">Not specified</SelectItem>
                  {VISIT_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block text-muted-foreground">Related Medication (Optional)</Label>
              <Select value={note.medicationTrackingId || "none"} onValueChange={(val) => updateField("medicationTrackingId", val)}>
                <SelectTrigger className="h-11 bg-muted/50 border-transparent rounded-xl">
                  <SelectValue placeholder="Select medication..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="none">None</SelectItem>
                  {medication && !cabinet.some((item) => item.cabinetId === currentTrackingId) && (
                    <SelectItem value={`tracker-${currentTrackingId}`}>
                      <div className="flex items-center gap-2">
                        <Syringe size={14} className="text-primary" /> {medication.brandName} (current GLP-1 tracker)
                      </div>
                    </SelectItem>
                  )}
                  {cabinet.map((item) => (
                    <SelectItem key={item.cabinetId} value={`tracker-${item.cabinetId}`}>
                      <div className="flex items-center gap-2">
                        <Syringe size={14} className="text-primary" />
                        {item.brandName} · {item.dose} mg{item.cabinetId === currentTrackingId ? " (current)" : " (previous)"}
                      </div>
                    </SelectItem>
                  ))}
                  {companions.map(c => (
                    <SelectItem key={c.id} value={`companion-${c.id}`}>
                      <div className="flex items-center gap-2">
                        <Pill size={14} className="text-secondary" /> {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Section 2: Preparation */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Preparing for Visit</h2>
          
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <Label className="text-sm font-medium mb-2 block">Information to share</Label>
              <Textarea 
                placeholder="Symptoms, side effects, changes in diet, or general updates since last visit..."
                className="min-h-[100px] bg-muted/30 border-border/50 rounded-xl resize-none text-sm"
                value={note.beforeVisit || ""}
                onChange={(e) => updateField("beforeVisit", e.target.value)}
              />
            </div>
            
            <div className="p-4 bg-muted/10">
              <Label className="text-sm font-medium mb-3 block">Questions to ask</Label>
              <div className="space-y-2 mb-3">
                {note.questions?.map((q) => (
                  <div key={q.id} className="flex gap-2 items-start group">
                    <button 
                      type="button"
                      className={`mt-1.5 shrink-0 ${q.discussed ? "text-secondary" : "text-muted-foreground"}`}
                      onClick={() => updateQuestion(q.id, { discussed: !q.discussed })}
                      title={q.discussed ? "Mark as not discussed" : "Mark as discussed"}
                    >
                      {q.discussed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </button>
                    <Input 
                      value={q.text} 
                      onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                      placeholder="Type your question..."
                      className={`h-9 bg-transparent border-transparent hover:border-border/50 focus:bg-background ${q.discussed ? "line-through text-muted-foreground" : ""}`}
                    />
                    <button 
                      type="button"
                      className="mt-1.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                      onClick={() => removeQuestion(q.id)}
                      aria-label="Remove question"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addQuestion} className="gap-2 rounded-xl text-xs h-8">
                <Plus size={14} /> Add question
              </Button>
            </div>
          </div>
        </section>

        {/* Section 3: During Visit */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">During Visit</h2>
          
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <Label className="text-sm font-medium mb-2 block">Information provided during the visit</Label>
            <Textarea 
              placeholder="Advice given, medication changes, next steps discussed..."
              className="min-h-[120px] bg-muted/30 border-border/50 rounded-xl resize-none text-sm"
              value={note.duringVisit || ""}
              onChange={(e) => updateField("duringVisit", e.target.value)}
            />
            <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed text-amber-800 font-medium">
                Entered by you. Jotrea does not verify, interpret, or replace healthcare-professional instructions.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: After Visit */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">After Visit</h2>
          
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <Label className="text-sm font-medium mb-2 block">Personal notes</Label>
              <Textarea 
                placeholder="How you felt about the visit, thoughts for next time..."
                className="min-h-[80px] bg-muted/30 border-border/50 rounded-xl resize-none text-sm"
                value={note.afterVisit || ""}
                onChange={(e) => updateField("afterVisit", e.target.value)}
              />
            </div>
            
            <div className="p-4 bg-muted/10">
              <Label className="text-sm font-medium mb-3 block">Follow-ups & Reminders (In-app only)</Label>
              <div className="space-y-2 mb-3">
                {note.followUps?.map((f) => (
                  <div key={f.id} className="flex gap-2 items-start group">
                    <button 
                      type="button"
                      className={`mt-1.5 shrink-0 ${f.completed ? "text-secondary" : "text-muted-foreground"}`}
                      onClick={() => updateFollowUp(f.id, { completed: !f.completed })}
                      aria-label={f.completed ? "Mark personal reminder incomplete" : "Mark personal reminder complete"}
                    >
                      {f.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </button>
                    <div className="flex flex-1 flex-col gap-2">
                      <Input 
                        value={f.text} 
                        onChange={(e) => updateFollowUp(f.id, { text: e.target.value })}
                        placeholder="E.g., Schedule bloodwork, pick up prescription..."
                        className={`h-9 bg-transparent border-transparent hover:border-border/50 focus:bg-background ${f.completed ? "line-through text-muted-foreground" : ""}`}
                      />
                      <Input
                        type="date"
                        value={f.date || ""}
                        onChange={(e) => updateFollowUp(f.id, { date: e.target.value || undefined })}
                        aria-label="Personal reminder date"
                        className="h-9 max-w-44 bg-muted/40 border-transparent"
                      />
                    </div>
                    <button 
                      type="button"
                      className="mt-1.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                      onClick={() => removeFollowUp(f.id)}
                      aria-label="Remove personal reminder"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addFollowUp} className="gap-2 rounded-xl text-xs h-8">
                <Plus size={14} /> Add follow-up
              </Button>
            </div>
          </div>
        </section>

        {/* Section 5: Metadata */}
        <section className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-6">
            
            <div>
              <Label className="text-sm font-medium mb-2 block">Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {note.tags?.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    <Tag size={12} /> {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:bg-secondary/30 rounded-full p-0.5" aria-label={`Remove ${tag} tag`}><Trash2 size={10} /></button>
                  </span>
                ))}
              </div>
              <Input
                placeholder="Type tag and press Enter..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={addTag}
                className="h-10 bg-muted/50 border-transparent rounded-xl max-w-xs"
              />
            </div>

            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Share2 size={14} className="text-primary" /> Include in Provider Summary
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-[240px]">
                    If enabled, this note will be visible in your on-screen Provider Visit Summary and included in the exported PDF.
                  </p>
                </div>
                <Switch 
                  checked={note.includeInProviderSummary} 
                  onCheckedChange={(c) => updateField("includeInProviderSummary", c)}
                  data-testid="switch-provider-summary"
                />
              </div>
            </div>

          </div>
        </section>

      </PageContainer>
      </div>
    </PlusGate>
  );
}