import { ArrowLeft, BookOpen, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { PageContainer } from "@/components/PageContainer";
import { useMedication } from "@/hooks/useMedication";

const CITATIONS: { label: string; source: string; url: string }[] = [
  {
    label: "FDA Prescribing Information — Ozempic (semaglutide)",
    source: "DailyMed, U.S. National Library of Medicine",
    url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=35902e95-e00c-47ae-8f4e-ba17d41881ce",
  },
  {
    label: "FDA Prescribing Information — Wegovy (semaglutide)",
    source: "DailyMed, U.S. National Library of Medicine",
    url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f5e548d0-cc79-4c34-a3f5-e20a5b8b6564",
  },
  {
    label: "FDA Prescribing Information — Mounjaro (tirzepatide)",
    source: "DailyMed, U.S. National Library of Medicine",
    url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d2d7da5d-ad07-4228-955f-cf7e355c8cc0",
  },
  {
    label: "FDA Prescribing Information — Zepbound (tirzepatide)",
    source: "DailyMed, U.S. National Library of Medicine",
    url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=487cd7e7-434c-4925-99fa-aa80b1cc776b",
  },
  {
    label:
      "Wilding JPH et al. Once-Weekly Semaglutide in Adults with Overweight or Obesity (STEP 1)",
    source: "N Engl J Med 2021; 384:989-1002",
    url: "https://www.nejm.org/doi/full/10.1056/NEJMoa2032183",
  },
  {
    label:
      "Jastreboff AM et al. Tirzepatide Once Weekly for the Treatment of Obesity (SURMOUNT-1)",
    source: "N Engl J Med 2022; 387:205-216",
    url: "https://www.nejm.org/doi/full/10.1056/NEJMoa2206038",
  },
  {
    label: "Mayo Clinic — Prescription weight-loss drugs",
    source: "Mayo Clinic",
    url: "https://www.mayoclinic.org/diseases-conditions/obesity/in-depth/prescription-weight-loss-drugs/art-20044832",
  },
  {
    label: "Novo Nordisk — Ozempic Patient Information",
    source: "Novo Nordisk",
    url: "https://www.novonordisk-us.com/products-and-therapies/diabetes-treatments/ozempic.html",
  },
  {
    label: "Eli Lilly — Mounjaro Patient Information",
    source: "Eli Lilly",
    url: "https://www.mounjaro.com",
  },
];

export default function Sources() {
  const [, setLocation] = useLocation();
  const { medication } = useMedication();

  return (
    <PageContainer>
      <div className="flex items-center gap-3 mb-1">
        <button
          onClick={() => setLocation(medication ? "/settings" : "/onboarding")}
          className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm"
          aria-label="Go back"
          data-testid="sources-back-btn"
        >
          <ArrowLeft size={16} className="text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Sources &amp; References</h1>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Medical information in Jotrea is sourced from the following authoritative references.
        Side-effect and safety information is drawn from the Adverse Reactions sections of the FDA
        prescribing information listed below.
      </p>

      <div className="bg-card rounded-3xl p-5 shadow-sm border border-border space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            References
          </h3>
        </div>
        <ul className="space-y-3">
          {CITATIONS.map((c) => (
            <li key={c.url} className="pb-3 border-b border-border last:border-b-0 last:pb-0">
              <button
                className="text-left w-full"
                onClick={() => window.open(c.url, "_blank", "noreferrer")}
                data-testid={`source-link-${c.url}`}
              >
                <span className="text-sm font-medium text-primary underline underline-offset-2 leading-snug inline-flex items-start gap-1.5">
                  {c.label}
                  <ExternalLink size={12} className="flex-shrink-0 mt-1" />
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">{c.source}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed pb-4">
        Jotrea is for tracking and education only. It does not diagnose, treat, or replace
        professional medical advice. Always consult your healthcare provider before making medical
        decisions.
      </p>
    </PageContainer>
  );
}
