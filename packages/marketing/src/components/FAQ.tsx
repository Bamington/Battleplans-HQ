/**
 * FAQ.tsx — Objection handling
 *
 * Venue page only. A shop owner deciding whether to list has questions a
 * player doesn't, and burying them in body copy makes the page look like it's
 * avoiding them.
 *
 * Native <button> triggers rather than <details>, so the open state can be
 * animated and only one item is open at a time.
 */

import { useState } from 'react';
import { Plus } from '../icons';
import { Reveal, SectionHeading } from './Section';

export interface FAQItem {
  question: string;
  answer: string;
}

export function FAQ({ title, items }: { title: string; items: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-[760px]">
      <Reveal>
        <SectionHeading title={title} align="center" />
      </Reveal>

      <Reveal delay={60}>
        <div className="mt-12">
          {items.map((item, i) => {
            const open = openIndex === i;
            return (
              <div key={item.question} className="mk-faq-item" data-open={open}>
                <h3>
                  <button
                    type="button"
                    className="mk-faq-trigger"
                    aria-expanded={open}
                    aria-controls={`faq-answer-${i}`}
                    onClick={() => setOpenIndex(open ? null : i)}
                  >
                    {item.question}
                    <Plus className="mk-faq-icon w-5 h-5" />
                  </button>
                </h3>
                <div
                  id={`faq-answer-${i}`}
                  hidden={!open}
                  className="pb-6"
                >
                  <p className="mk-body-sm mk-measure">{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Reveal>
    </div>
  );
}
