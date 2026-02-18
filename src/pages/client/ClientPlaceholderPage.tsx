import { useLocation } from "react-router-dom";

export default function ClientPlaceholderPage() {
  const location = useLocation();
  const pageName = location.pathname.split("/").pop()?.replace(/-/g, " ") || "Page";

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h2 className="text-xl font-semibold text-foreground capitalize mb-2">{pageName}</h2>
      <p className="text-muted-foreground">This section is coming soon.</p>
    </div>
  );
}
