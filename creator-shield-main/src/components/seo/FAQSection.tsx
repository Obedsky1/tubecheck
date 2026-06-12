interface FAQ {
  q: string;
  a: string;
}

export function FAQSection({ faqs }: { faqs: FAQ[] }) {
  if (!faqs || faqs.length === 0) return null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-24 md:px-6 w-full">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-semibold tracking-tight">Frequently Asked Questions</h2>
        <p className="mt-2 text-muted-foreground">Common questions about YouTube compliance and our scanning technology.</p>
      </div>
      <div className="space-y-6">
        {faqs.map((faq, i) => (
          <div key={i} className="rounded-xl border bg-card p-6 hairline shadow-sm">
            <h3 className="text-lg font-medium">{faq.q}</h3>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
