import { Link } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  path: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  // Generate BreadcrumbList JSON-LD Schema
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://tubecheck.live/"
      },
      ...items.map((item, index) => ({
        "@type": "ListItem",
        "position": index + 2,
        "name": item.label,
        "item": `https://tubecheck.live${item.path}`
      }))
    ]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-4 pt-6 md:px-6">
        <ol className="flex items-center space-x-2 text-xs text-muted-foreground">
          <li>
            <Link to="/" className="flex items-center hover:text-foreground transition-colors">
              <Home className="h-3.5 w-3.5" />
              <span className="sr-only">Home</span>
            </Link>
          </li>
          {items.map((item, index) => (
            <li key={index} className="flex items-center space-x-2">
              <ChevronRight className="h-3 w-3" />
              <Link
                to={item.path}
                className={index === items.length - 1 ? "font-medium text-foreground" : "hover:text-foreground transition-colors"}
                aria-current={index === items.length - 1 ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
