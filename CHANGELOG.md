# Changelog

## v1.0.4 (2026-08-24)

A run that finished cleanly could still tell your script it had failed.

Headless runs report the right exit status again. A run that ended normally on its end
marker would print `(exit code: 0)` and then hand the shell a **1** — sometimes. Roughly
half of otherwise identical runs did it, which is the worst way for a fault like this to
behave: anything scripted around this tool saw a successful run fail at random, and
re-running it appeared to fix it. Nothing was actually wrong with the run. The log was
complete, the download had worked, the P2 had done its job; only the number handed back
at the very end was wrong, and it was wrong *after* the app had already decided on the
right one.

The cause was in shutting down, not in running. While closing the serial port on the way
out, the app did not wait for the close to finish, so if the port objected — which it does
now and then, when the P2 is still transmitting at the moment the run ends — the complaint
arrived with nobody left listening for it. Node treats that as a crash and overrides the
exit status with a 1, on top of the one already chosen. The close is now waited for, and a
port that objects on the way out is reported and ignored, which is all it ever deserved.

The exit status is now protected from this whole class of fault. Two things changed beyond
the one bad line. If something does go wrong after a run has decided its result, the app
now says so plainly and **keeps the result it decided** — a stumble while closing a file or
a port is not a reason to tell you the run failed. And every remaining place that could
have done the same thing has been found and fixed, including the five that decide the exit
code in the first place: a shutdown that goes wrong still reports its verdict rather than
vanishing. A check now runs before every release and refuses to ship this construct again.

Nothing about how you use the app has changed. If you have scripts that were tolerating
random failures from this tool — retrying, or ignoring the exit status — they can stop.

## v1.0.3 (2026-08-23)

The two serial speeds this app uses now have honest names, and the one that was fixed at 2 Mbps is yours to change.

There were always two speeds, and only one of them had a name that said so. One carries the
DEBUG output your program prints and anything you type at the terminal — a single rate, because
it is a single serial connection. The other is used only for the moment a program is being
loaded into the P2. The first was called the debug baud, which described half of what it does
and read as irrelevant if you were using this as a plain serial terminal — the one case where
it is the only setting that matters, since there is no downloaded program to take a rate from.
It is now the **serial baud**: `--baud` on the command line, "Serial Baud Rate" in Preferences.
`--debugbaud` still works, and will continue to.

The download speed is no longer fixed. It sat at 2 Mbps with no way to change it, which is fine
on Parallax hardware and a dead end on a USB adapter that cannot hold that rate — the download
would simply never complete, and there was nothing to try. There is now a **download baud**:
`--downloadbaud` on the command line, "Download Baud Rate" in Preferences. The P2's loader
adapts to whatever you send it, anywhere from 9600 to 2000000, so lowering this costs loading
time and nothing else. A value outside that window is refused with the window named, because
outside it the chip cannot hear us at all.

You are told when you go above what has been measured. Sustained streaming is verified to
2 Mbps. Ask for more and the app now says so — not that it will fail, but that nobody has run
the experiment, so it may carry the stream perfectly or it may drop data. It does not stop you,
and if you do run faster we would like to hear what you saw.

Headless runs now honor a program's own DEBUG_BAUD. If your source set a rate other than the
default, a headless run would read that rate, record it, and then carry on listening at the old
one — filling the log with garbage that looked like a hardware fault. Windowed runs were always
correct; headless now matches them.

## v1.0.2 (2026-08-14)

The debug log keeps up with your program, and a release build stops talking about itself.

The debug log window follows the tail again. When a program finished, the log could be
left parked part-way up, hiding the last lines it printed — and once that happened the
window stayed there for the rest of the session, since only scrolling back to the bottom
yourself would resume live mode. The window had been scrolling itself smoothly, and its
own animation looked exactly like you scrolling up. It now jumps to the tail, and it can
tell its own scrolling from yours. The per-COG log windows had the same fault and are
fixed with it.

Three further log-window faults found alongside it. The scrollback preference now does
something: it had been read by nothing, while a fixed cap of 1500 lines did the trimming
regardless of what you set. It is now the setting that decides how far back you can
scroll, it applies the moment you change it rather than waiting for new output, and it
survives closing and reopening the viewer — which also means the default is now the 1000
lines the preference always advertised, rather than the 1500 nobody could change. On the
way out, quitting the app or ending a batch run could strand everything past the first
hundred queued lines and close the window without waiting for the rest to appear — the
log now empties its queue completely and waits for the window to draw it. And reopening
the log viewer no longer reports that the display fell behind: the replayed history was
being fed through the live-output path, which discarded most of it and then said so.

Serial line-control detail no longer prints during ordinary runs. A release build was
writing a bare column of `DTR: true` / `DTR: false` / `RTS: false` and a handle-closing
note to the console — the individual line transitions that carry out a reset, rather than
the reset itself. The reset is still announced, once, as it always was; the transitions
that implement it, and the handle bookkeeping around them, now appear only under
`--diag-serial`, alongside the rest of the serial-channel troubleshooting detail. A line
that fails to assert is still reported either way. On Windows, the note that the
synchronous COM transport is in use has moved there too — it is the normal case and
nothing to act on, while its *absence* still says so plainly, because downloading cannot
work without it.

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
