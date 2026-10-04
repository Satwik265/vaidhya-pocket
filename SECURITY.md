# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 2.x     | Yes       |
| 1.x     | Legacy    |

## Reporting a Vulnerability

Security is paramount for clinical software. If you discover a security vulnerability or potential data privacy concern within MedScribeAI:

1. **Do not open a public GitHub issue.**
2. Report vulnerabilities privately via GitHub Security Advisories or by emailing the project maintainers directly.
3. Reports should include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
4. The maintenance team will acknowledge receipt within 24 hours and coordinate remediation.

---

## Last Security Review: 2026-07-31

### Audit Findings & Security Posture
- **Dependency Audit (`npm audit`)**: Clean — 0 high or critical vulnerabilities identified in installed packages.
- **Secret Management**: Verified zero committed secrets in git. `GEMINI_API_KEY` is strictly accessed via server environment variables (`process.env.GEMINI_API_KEY`) inside Node.js (`server.ts`) and is never exposed to client-side bundles.
- **Backend API & Error Handling**:
  - `server.ts` handles clinical API requests server-side.
  - Express backend sanitizes API error messages without leaking internal stack traces to HTTP client responses.
  - Server operates as an integrated Vite SPA / Express application on single-origin deployment; CORS middleware is strictly unexposed/scoped.
- **Prompt Injection & LLM Guardrails**:
  - System instructions enforce strict factual extraction from provided clinical transcripts.
  - Temperature set to `0.1` for factual precision and structured JSON schema enforcement (`responseMimeType: 'application/json'`).
  - **Implemented Remediation**: Prompt inputs in `server.ts` are wrapped in explicit boundary delimiter tags (`<patient_demographics>` and `<clinical_transcript>`), with system instructions explicitly dictating that all content within these tags must strictly be treated as raw data to extract from, never as system commands or instructions.
- **Data Governance & Statutory Compliance**:
  - **Digital Personal Data Protection (DPDP) Act 2023 Compliance**:
    - Patient consent is collected through an explicit, granular, and purpose-specific consent gate prior to intake initiation (covering voice processing, document digitization, and hospital record transmission).
    - In compliance with the DPDP Act 2023 notice requirements, all consent clauses feature accessible auditory read-aloud functionality via browser speech synthesis to ensure informed consent for low-literacy patients and regional language speakers.
    - Patient intake data collected during self-service kiosk sessions is held transiently in active application memory and automatically purged upon session completion or an inactivity countdown timeout (120s).
  - **Ayushman Bharat Digital Mission (ABDM) Consent Architecture**:
    - Aligned with National Health Authority (NHA) ABDM Milestone standards (M1: ABHA issuance & verification; M2: Health Information Provider document creation; M3: Consent-managed health data exchange).
    - **Simulated ABDM Gateway Notice**: ABHA verification and ABDM network connectivity are **simulated** in this SIH 26047 build and evaluation environment. Mock lookup and tokenization simulate real-world ABDM Gateway OTP/biometric flows without transmitting live citizen identifiers to external third-party servers.
    - **Stated Production Integration Next Step**: Transition to production ABDM Sandbox M1/M2/M3 gateway certification, National Health Claims Exchange (NHCX) readiness, and integration with hospital Electronic Medical Record (EMR) / Hospital Information Management Systems (HIMS) via certified Health Information Provider (HIP) and Health Information User (HIU) bridges.
- **Data Persistence & LocalStorage**:
  - Browser `localStorage` is restricted to demonstration presets and synthetic mock encounters.
  - **Public Terminal Data Privacy**: The MediKiosk terminal does not persist citizen ABHA tokens, national identity numbers, or raw patient audio recordings in unencrypted browser storage. Session state is wiped immediately upon kiosk timeout or new patient intake trigger.
