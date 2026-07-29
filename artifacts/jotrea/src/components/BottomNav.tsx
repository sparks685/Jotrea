import { useLocation, Link } from "wouter";
import { Home, Calendar, Scale, Pill, Settings } from "lucide-react";
import { motion } from "framer-motion";

const tabs = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/calendar", icon: Calendar, label: "Calendar" },
  { href: "/weight", icon: Scale, label: "Weight" },
  { href: "/med-info", icon: Pill, label: "Med Info" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card/95 backdrop-blur-lg border-t border-border z-50"
      data-testid="bottom-nav"
    >
      <div className="flex items-center justify-around px-2 py-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}>
        {tabs.map(({ href, icon: Icon, label }) => {
          const isActive =
            href === "/"
              ? location === "/" || location === ""
              : location.startsWith(href);
          return (
            <Link key={href} href={href} asChild>
              <button
                data-testid={`nav-${label.toLowerCase().replace(" ", "-")}`}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[44px] min-h-[44px] justify-center transition-all duration-200"
              >
                <motion.div
                  animate={{ scale: isActive ? 1.1 : 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 1.8}
                    className={isActive ? "text-primary" : "text-muted-foreground"}
                  />
                </motion.div>
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
