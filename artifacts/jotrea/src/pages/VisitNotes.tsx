import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Search, FileText, Calendar, User, Briefcase, Tag, Trash2, Share2, EyeOff } from "lucide-react";
import { format, parseISO } from "date-fns";
import { PageContainer } from "@/components/PageContainer";
import { BackToSettingsButton } from "@/components/BackToSettingsButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusGate } from "@/components/PlusGate";
import { useVisitNotes } from "@/hooks/useVisitNotes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { VisitNote } from "@/types";

export default function VisitNotes() {
  const { notes, setNotes } = useVisitNotes();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  
  // Sort descending by visit date
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  }, [notes]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach(note => note.tags?.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [notes]);

  const filteredNotes = useMemo(() => {
    return sortedNotes.filter((note) => {
      const q = search.trim().toLowerCase();
      const searchableText = [
        note.providerName,
        note.specialty,
        note.visitType,
        note.reason,
        note.beforeVisit,
        note.duringVisit,
        note.afterVisit,
        ...(note.tags ?? []),
        ...(note.questions ?? []).map((question) => question.text),
        ...(note.followUps ?? []).map((followUp) => followUp.text),
      ].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !q || searchableText.includes(q);
      const matchesTag = !selectedTag || (note.tags && note.tags.includes(selectedTag));
      return matchesSearch && matchesTag;
    });
  }, [sortedNotes, search, selectedTag]);

  const handleDelete = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  return (
    <PlusGate feature="Visit Notes">
      <PageContainer className="space-y-6">
        <BackToSettingsButton />
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Visit Notes</h1>
            <p className="mt-1 text-sm text-muted-foreground">Your personal notebook for healthcare visits.</p>
          </div>
          <Button
            className="rounded-full shadow-md gap-2"
            onClick={() => setLocation("/visit-notes/new")}
            data-testid="button-new-visit-note"
          >
            <Plus size={16} /> New
          </Button>
        </div>

        {notes.length > 0 ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                type="search"
                placeholder="Search notes, providers, reasons..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11 bg-card rounded-xl border-border focus-visible:ring-primary shadow-sm"
                data-testid="input-search-notes"
              />
            </div>

            {allTags.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                <button
                  type="button"
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedTag === null ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  onClick={() => setSelectedTag(null)}
                >
                  All
                </button>
                {allTags.map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      selectedTag === tag ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                    onClick={() => setSelectedTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3 pt-2">
              {filteredNotes.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-foreground">No matching notes</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters.</p>
                </div>
              ) : (
                filteredNotes.map((note) => (
                  <NoteCard key={note.id} note={note} onDelete={() => handleDelete(note.id)} />
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-card rounded-3xl border border-border shadow-sm mt-4">
            <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-5">
              <FileText size={28} />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Prepare for your next visit</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-[260px]">
              Keep track of questions you want to ask, information provided during visits, and personal follow-up reminders.
            </p>
            <Button
              className="rounded-xl px-6"
              onClick={() => setLocation("/visit-notes/new")}
              data-testid="button-create-first-note"
            >
              Create your first note
            </Button>
          </div>
        )}
      </PageContainer>
    </PlusGate>
  );
}

function NoteCard({ note, onDelete }: { note: VisitNote; onDelete: () => void }) {
  const hasContent = note.beforeVisit || note.duringVisit || note.afterVisit || (note.questions && note.questions.length > 0) || (note.followUps && note.followUps.length > 0);
  const openFollowUps = (note.followUps ?? []).filter((followUp) => !followUp.completed && followUp.text.trim()).length;

  return (
    <div className="group bg-card rounded-2xl border border-border p-4 shadow-sm relative transition-all hover:border-primary/40 hover:shadow-md">
      <Link href={`/visit-notes/${note.id}`} className="absolute inset-0 z-10" data-testid={`link-note-${note.id}`}><span className="sr-only">Edit note</span></Link>
      
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 text-primary font-medium text-sm">
          <Calendar size={14} />
          <span>{format(parseISO(note.visitDate), "MMMM d, yyyy")}</span>
        </div>
        
        <div className="flex items-center gap-1.5 z-20">
          {note.includeInProviderSummary ? (
            <div className="bg-primary/10 text-primary p-1.5 rounded-lg flex items-center justify-center" title="Shared in Provider Summary">
              <Share2 size={13} />
            </div>
          ) : (
             <div className="bg-muted text-muted-foreground p-1.5 rounded-lg flex items-center justify-center" title="Private (Not shared)">
              <EyeOff size={13} />
            </div>
          )}
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button 
                type="button"
                className="p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                aria-label={`Delete visit note from ${format(parseISO(note.visitDate), "MMMM d, yyyy")}`}
                data-testid={`button-delete-note-${note.id}`}
              >
                <Trash2 size={14} />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="w-[calc(100%-40px)] max-w-md rounded-3xl p-6">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this visit note?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your note from {format(parseISO(note.visitDate), "MMMM d, yyyy")}. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-6 flex-col-reverse sm:flex-col-reverse gap-3 sm:gap-0">
                <AlertDialogCancel className="mt-0 w-full h-12 rounded-xl text-base font-semibold border-0 bg-muted hover:bg-muted/80">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  className="w-full h-12 rounded-xl text-base font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg" 
                  onClick={onDelete}
                >
                  Delete Note
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="space-y-1.5 mb-4">
        {note.providerName && (
          <div className="flex items-center gap-2 text-sm text-foreground">
            <User size={14} className="text-muted-foreground shrink-0" />
            <span className="font-medium">{note.providerName}</span>
            {note.specialty && <span className="text-muted-foreground">({note.specialty})</span>}
          </div>
        )}
        {note.reason && (
          <div className="flex items-start gap-2 text-sm text-foreground">
            <Briefcase size={14} className="text-muted-foreground shrink-0 mt-0.5" />
            <span className="line-clamp-2">{note.reason}</span>
          </div>
        )}
      </div>

      {hasContent && (
        <div className="bg-muted/50 rounded-xl p-3 mb-4">
          <p className="text-xs text-muted-foreground line-clamp-2">
            {note.duringVisit || note.beforeVisit || note.afterVisit || (note.questions && note.questions.length > 0 ? `${note.questions.length} questions` : "") || (note.followUps && note.followUps.length > 0 ? `${note.followUps.length} follow-ups` : "Empty note")}
          </p>
          {openFollowUps > 0 && (
            <p className="mt-2 text-xs font-semibold text-primary">
              {openFollowUps} open personal reminder{openFollowUps === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}

      {note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {note.tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              <Tag size={10} /> {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}