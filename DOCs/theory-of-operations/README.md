# Theory of Operations - Serial Message Processing

This directory contains the formal architecture documentation for the PNut-Term-TS serial message processing system with Worker Thread extraction.

## Primary Document

📘 **[SERIAL-MESSAGE-PROCESSING-ARCHITECTURE.md](SERIAL-MESSAGE-PROCESSING-ARCHITECTURE.md)**
- **Formal architecture specification** (35KB)
- Complete system design, threading model, data structures
- Performance characteristics, error handling, design rationale
- **START HERE** for understanding the system architecture

## Supporting Documents

### Design & Planning

📄 **[WORKER_THREAD_EXTRACTION_DESIGN.md](WORKER_THREAD_EXTRACTION_DESIGN.md)** (10KB)
- Original design document for Worker Thread approach
- Problem analysis (44% message loss)
- Architecture decisions and proof of concept

📄 **[WORKER_THREAD_INTEGRATION_PLAN.md](WORKER_THREAD_INTEGRATION_PLAN.md)** (22KB)
- Detailed integration plan
- Work breakdown (12-17 hours estimated)
- Testing strategy and success criteria

### Implementation Guide

📋 **[WORKER_INTEGRATION_CHECKLIST.md](WORKER_INTEGRATION_CHECKLIST.md)** (10KB)
- Quick reference checklist
- Phase-by-phase task breakdown
- Estimated effort per task
- File modification list

### Status & History

📊 **[WORKER_STATUS.md](WORKER_STATUS.md)** (2.4KB)
- Current implementation status
- What's been built (SharedCircularBuffer, simple Worker)
- Test results (65,539/65,539 messages, 0% loss)

### Alternative Approaches

🔍 **[WORKER_OWNS_SERIALPORT_ANALYSIS.md](WORKER_OWNS_SERIALPORT_ANALYSIS.md)** (10KB)
- Analysis of alternative architecture (Worker owns SerialPort)
- Comparison with chosen approach
- Why main thread ownership is simpler

## Document Hierarchy

```
Theory of Operations
├── SERIAL-MESSAGE-PROCESSING-ARCHITECTURE.md  ← MAIN SPECIFICATION
│
├── Design Phase
│   ├── WORKER_THREAD_EXTRACTION_DESIGN.md
│   └── WORKER_OWNS_SERIALPORT_ANALYSIS.md
│
├── Implementation Phase
│   ├── WORKER_THREAD_INTEGRATION_PLAN.md
│   └── WORKER_INTEGRATION_CHECKLIST.md
│
└── Status
    └── WORKER_STATUS.md
```

## Quick Navigation

**Need to understand the architecture?**
→ Read [SERIAL-MESSAGE-PROCESSING-ARCHITECTURE.md](SERIAL-MESSAGE-PROCESSING-ARCHITECTURE.md)

**Need to implement the system?**
→ Follow [WORKER_INTEGRATION_CHECKLIST.md](WORKER_INTEGRATION_CHECKLIST.md)

**Need to see what's done?**
→ Check [WORKER_STATUS.md](WORKER_STATUS.md)

**Curious about alternatives?**
→ Review [WORKER_OWNS_SERIALPORT_ANALYSIS.md](WORKER_OWNS_SERIALPORT_ANALYSIS.md)

## Key Concepts

### Problem
USB serial data arrives at 2 Mbps (packets every ~4ms), but message extraction takes 5-6ms, blocking the event loop and causing 44% message loss.

### Solution
Worker Thread architecture:
- **Main thread:** Fast USB reception (~0.3ms) → SharedCircularBuffer → return to event loop
- **Worker thread:** Parallel extraction (5-6ms doesn't matter) → SharedMessagePool → postMessage
- **Result:** 0% message loss (proven with 65,539 messages)

### Key Technologies
- **SharedArrayBuffer** - Zero-copy shared memory
- **Atomics** - Lock-free thread synchronization
- **Worker Threads** - Parallel message extraction
- **Reference Counting** - Zero-copy message routing

---

**For questions or updates, refer to the main architecture document first.**
