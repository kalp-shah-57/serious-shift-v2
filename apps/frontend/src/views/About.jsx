/**
 * About — placeholder page.
 *
 * Intentionally minimal. Drop real content into the body section when ready.
 */
export default function About() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-4">
        About
      </p>
      <h1 className="font-editorial text-4xl sm:text-5xl leading-[1.05] text-cream mb-6">
        Serious Shi<span className="text-accent">(f)</span>t
      </h1>
      <p className="text-neutral-400 text-base sm:text-lg leading-relaxed">
        A continuously updated keynote on how AI is reshaping the economy and
        consumer behavior — built from the work of 70 thinkers.
      </p>
      <p className="text-neutral-500 text-sm mt-8">
        More about the project is coming soon.
      </p>
    </div>
  )
}
