# Changelog

## v1.0.1 (2026-08-12)

Single-step debugger input now matches PNut.

A close reading of PNut's debugger against ours found sixteen places where the mouse,
wheel, keyboard and hint-bar behavior had drifted — intended behavior that was missed,
not new capability. The most visible: the mouse wheel over the hub data pane moved
sixteen rows per notch instead of one, and its Ctrl nudge moved sixteen bytes instead of
one. Scrolling the disassembly in hub mode now moves the hub viewer with it, as PNut's do
— they are one address, not two — and scrolling cog space stops at the end instead of
wrapping around to register zero.

Clicks reach the regions they always should have: the hub ASCII column, either mouse
button on BREAK, and a right-click on a hub-mode disassembly line below `$400` is now
refused rather than setting a breakpoint that cannot be hit. Clicking a REG or LUT heat
strip places the register you clicked in the middle of the window rather than on its top
line, and an interrupt vector holding a hub address now follows that address into hub
space. The hint bar names the event row you are actually pointing at, six regions that
were silent now describe themselves, and the wheel no longer scrolls when the pointer is
over the hub heatmap.

Keyboard commands now match PNut, including on non-QWERTY layouts: commands follow the
character you type rather than the physical key position, and the five control
combinations PNut answers — Ctrl+C, Ctrl+D, Ctrl+K, Ctrl+L for hub navigation and Ctrl+M
for repeat — do so here too.

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
