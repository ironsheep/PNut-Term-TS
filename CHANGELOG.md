# Changelog

## v1.0.0 (2026-07-27)

The first public release.

PNut-Term-TS is a debug terminal for the Parallax Propeller 2. It downloads a compiled
program to a P2 over a serial connection and then presents everything the P2 sends back —
as a serial terminal, as the P2's debug display windows, and in the single-step debugger —
while writing the whole session to a timestamped log file. It runs on Windows, macOS, and
Linux, on both x64 and arm64, and it runs with or without a graphical interface, so the
same tool serves a person at a desk and an automated hardware-in-the-loop test. Its
handling of the DEBUG display language follows PNut v55. It brings together the runtime
halves of PNut and Parallax Serial Terminal in one executable, and adds the automatic
logging that neither of them has.
