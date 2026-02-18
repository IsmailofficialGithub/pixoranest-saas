import { useLocation } from "react-router-dom";

export default function PlaceholderPage() {
  const { pathname } = useLocation();
  const title = pathname.split("/").pop()?.replace(/-/g, " ") ?? "Page";

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground capitalize">{title}</h1>
      <p className="mt-1 text-muted-foreground">This section is coming soon.</p>
    </div>
  );
}
