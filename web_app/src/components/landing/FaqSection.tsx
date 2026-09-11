import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FaqItem[] = [
    {
      question: "Does Praxirence store or record consultation audio?",
      answer: "No. Praxirence strictly implements a Zero Audio Retention architecture. Audio streams are processed ephemerally in RAM during the consultation solely to generate the textual transcript. Once parsed, the raw audio buffer is permanently erased from memory. Audio is never stored on disk or used for training without explicit clinical authorization."
    },
    {
      question: "Why is physician verification mandatory before WhatsApp dispatch?",
      answer: "In compliance with established telemedicine practice guidelines and medico-legal standards, AI can propose clinical notes, but only a qualified attending physician can legally prescribe and dispatch treatments. Praxirence locks the dispatch button until the clinician reviews and checks the clinical sign-off box."
    },
    {
      question: "How does offline mode work when the clinic has no internet?",
      answer: "Both Praxirence mobile apps feature local offline SQLite and SQLiteCipher vaults. If internet is lost during a consultation, care plans are queued and signed locally with cryptographic timestamps. When connectivity is restored, plans sync automatically to the cloud engine."
    },
    {
      question: "Do patients need to install an app to receive their care plan?",
      answer: "No. While the Praxirence Patient App offers medication reminders and consent management, patients receive their full signed care plan, vernacular instructions, and prescription PDF directly on WhatsApp as a standard document, ensuring 100% reach even on basic smartphones."
    },
    {
      question: "How does Praxirence comply with the DPDP Act 2023 and ABDM?",
      answer: "Praxirence acts as a compliant Data Processor under the Digital Personal Data Protection Act 2023. Patient health data is encrypted using AES-256 GCM, consent logs are immutably recorded, and patients can request data erasure or export at any time. Our schema is natively compatible with ABDM FHIR M2 health standards."
    }
  ];

  return (
    <section id="faq" className="landing-section" style={{ paddingTop: '40px' }}>
      <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto 36px auto' }}>
        <div className="section-tag">
          <HelpCircle size={14} />
          <span>Frequently Asked Questions</span>
        </div>
        <h2 className="section-title">Clinical, Legal & Technical FAQs</h2>
        <p className="section-subtitle" style={{ margin: '0 auto' }}>
          Everything doctors, patients, clinic administrators, and health fiduciaries need to know about Praxirence's clinical architecture.
        </p>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="landing-card"
              style={{
                borderRadius: '14px',
                border: isOpen ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid var(--landing-border)',
                overflow: 'hidden',
                transition: 'all 0.2s ease'
              }}
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '18px 20px',
                  background: isOpen ? 'rgba(2, 132, 199, 0.03)' : '#ffffff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '1rem', fontWeight: 700, color: isOpen ? '#0284c7' : '#0f172a' }}>
                  {faq.question}
                </span>
                <ChevronDown
                  size={18}
                  color={isOpen ? '#0284c7' : '#94a3b8'}
                  style={{
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform 0.2s ease',
                    flexShrink: 0
                  }}
                />
              </button>

              {isOpen && (
                <div style={{ padding: '0 20px 18px 20px', color: '#475569', fontSize: '0.925rem', lineHeight: 1.6 }}>
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
