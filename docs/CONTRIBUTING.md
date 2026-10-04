# Contributing to MedScribeAI

Thank you for your interest in contributing to MedScribeAI.

MedScribeAI is a clinical software platform designed for high-stakes healthcare environments. As such, all contributions must adhere to strict software engineering standards, deterministic safety guarantees, and clinical integrity principles.

---

## 1. Core Engineering Principles

Every contributor must observe three non-negotiable principles:

1. **The Zero-Fabrication Invariant:** Never write code that defaults missing data into a clinical fact. Missing symptoms or history must remain undocumented (`NOT_ELICITED`). No synthetic default values (such as "120/80 mmHg" or "No Known Drug Allergies") may ever be generated.
2. **Deterministic Safety Primacy:** Emergency red-flag detection, drug interaction checks, and allergy cross-reactivity must remain deterministic and auditable. Never delegate safety gating to probabilistic language models.
3. **Offline Sovereignty First:** All core features must operate without an active internet connection. Do not introduce mandatory external network dependencies into the core consultation flow.

---

## 2. Development Setup

### 2.1 Prerequisites
- **Node.js:** v18.0.0 or higher (v20+ recommended)
- **npm:** v9.0.0 or higher
- **Python:** v3.11 or higher (tested up to v3.14)
- **Rust & Cargo:** v1.75.0 or higher (for native desktop shell development)

### 2.2 Installing Dependencies

#### Frontend:
```bash
npm install
```

#### Backend:
```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate

# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

---

## 3. Verification & Quality Gates

Before submitting any Pull Request, you must verify that all four quality gates pass cleanly on your local machine:

### Gate 1: Frontend Typecheck & Lint
```bash
npm run lint
```
*Requirement:* Zero TypeScript errors (`tsc --noEmit`).

### Gate 2: Frontend Unit & Integration Tests
```bash
npm test -- --run
```
*Requirement:* 100% of frontend tests must pass (345/345).

### Gate 3: Backend Pytest Suite
```bash
pytest
```
*Requirement:* All active unit and benchmark tests must pass (89/89). Tests requiring external binaries (like Tesseract) may remain skipped when the binary is absent.

### Gate 4: Production Bundle
```bash
npm run build
```
*Requirement:* Production Vite bundling and Node server compilation must succeed.

---

## 4. Coding Standards

### 4.1 TypeScript & React
- Use strict TypeScript types. Avoid `any` where possible.
- Favor explicit interfaces over ambiguous type assertions.
- Do not use unicode emojis in UI copy, buttons, or error messages. Use Lucide SVG icons instead.
- Component state mutations must preserve clinical evidence grounding.

### 4.2 Python & FastAPI
- Adhere to PEP 8 standards and use type annotations on all function signatures.
- All models representing medical concepts must derive from or map to `ClinicalFact`.
- Ensure all database interactions utilize parameterized queries with foreign keys enabled.

### 4.3 Documentation
- Keep technical documentation factual, precise, and devoid of marketing hype.
- Never claim regulatory certification (e.g. "ABDM Certified") unless official government accreditation has been completed and documented.

---

## 5. Submitting a Pull Request

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Commit your changes with clear, semantic commit messages:
   ```bash
   git commit -m "clinical: add pediatric dosage validation to drug interaction engine"
   ```
3. Ensure all local tests and builds pass.
4. Push your branch and open a Pull Request against `main`.
5. Clearly describe the problem, changes made, and test commands used for validation in the PR description.
