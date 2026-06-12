import { createFileRoute, notFound } from "@tanstack/react-router";
import { rootPages } from "@/data/seo-pages";
import { ServiceLandingPage } from "@/components/seo/ServiceLandingPage";
import { generateSEOSchemas } from "@/lib/seo";

export const Route = createFileRoute("/$serviceId")({
  loader: ({ params }) => {
    const data = rootPages[params.serviceId];
    if (!data) throw notFound();
    return { pageData: data, id: params.serviceId };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { pageData } = loaderData;
    
    return {
      meta: [
        { title: pageData.title },
        { name: "description", content: pageData.description },
        { property: "og:title", content: pageData.title },
        { property: "og:description", content: pageData.description },
      ],
      scripts: generateSEOSchemas(pageData)
    };
  },
  component: () => <ServiceLandingPage pageData={Route.useLoaderData().pageData} slug={Route.useLoaderData().id} />,
});
