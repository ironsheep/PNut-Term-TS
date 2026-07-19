# PNut-Term-TS - Command Line

![Project Maintenance][maintenance-shield]

[![License][license-shield]](LICENSE)

![NodeJS][node-badge]

[![Release][Release-shield]](https://github.com/ironsheep/PNut-Term-TS/releases)

[![GitHub issues][Issues-shield]](https://github.com/ironsheep/PNut-Term-TS/issues)

## Everyday Use of PNut-Term-TS

Our new PNut-Term-TS will show you the following when you specify `-h` or `--help`:

```text

PNut-Term-TS: Usage: pnut-term-ts [options]

PNut Terminal TS - v0.9.99

Options:
  -V, --version            Output the version number
  -f, --flash <fileSpec>   Download to FLASH and run
  -r, --ram <fileSpec>     Download to RAM and run
  -b, --debugbaud <rate>   Override the debug baud rate (default: taken from the
                           binary being downloaded, else 2000000)
  -p, --plug <dvcNode>     Receive serial data from Propeller attached to
                           <dvcNode> (auto-detects if only one USB serial
                           device)
  -n, --dvcnodes           List available USB serial device (n)odes (use with -m
                           to list all FTDI devices)
  -d, --debug              Output Term-TS Debug messages
  -v, --verbose            Output Term-TS Verbose messages
  -q, --quiet              Quiet mode (suppress Term-TS banner and non-error
                           text)
  -m, --match-vendor-only  Match any FTDI device (VID 0x0403), ignore product ID
  --ide                    IDE mode - minimal UI for VSCode/IDE integration
  --rts                    Use RTS instead of DTR for device reset
  -u, --log-usb-trfc       Enable USB traffic logging (timestamped log file)
  --console-mode           Running with console output - adds delay before close
  --headless               Run without GUI windows (file logging only, for CI/AI
                           agents)
  --timeout <seconds>      Exit after specified seconds (headless mode only)
  --end-marker [phrase]    Exit when phrase seen in output (default: END_SESSION
                           or DEBUG_END_SESSION)
  --exit-on-end-session    Headed batch mode: exit the app (draining in-flight
                           saves/logs) on the end-session marker /
                           DEBUG_END_SESSION
  -h, --help               display help for command

      Examples:
         $ pnut-term-ts                                          # auto-detects and uses USB serial device (if only one connected)
         $ pnut-term-ts -p P9cektn7                              # run using PropPlug on /dev/tty.usbserial-P9cektn7
         $ pnut-term-ts -r myTopfile.bin                         # download to RAM (auto-detects single USB device)
         $ pnut-term-ts -r myTopfile                             # ".bin" assumed when no extension given (→ myTopfile.bin)
         $ pnut-term-ts -r myTopfile.bin -p P9cektn7             # download myTopfile.bin to RAM and run
         $ pnut-term-ts --ide                                    # IDE mode (auto-detects single USB device)
         $ pnut-term-ts --ide -p P9cektn7                        # IDE mode for VSCode integration
         $ pnut-term-ts --ide --rts -p P9cektn7                  # IDE mode using RTS instead of DTR for device reset
         $ pnut-term-ts -u -p P9cektn7                           # Enable USB traffic logging (timestamped log file)

      Headless Mode (for CI/AI agents):
         $ pnut-term-ts --headless -p P9cektn7                   # Run without GUI, log to file, exit on Ctrl+C
         $ pnut-term-ts --headless -r test.bin --end-marker      # Download, run until END_SESSION or DEBUG_END_SESSION
         $ pnut-term-ts --headless -r test.bin --timeout 60      # Download, run for 60 seconds then exit
         $ pnut-term-ts --headless --end-marker "TEST_DONE"      # Exit when custom phrase seen in output

      Headed batch mode (render windows, then auto-exit — e.g. dump bitmaps per file):
         $ pnut-term-ts -r gen.bin --exit-on-end-session         # Open windows, exit on DEBUG_END_SESSION (drains saves first)
         $ pnut-term-ts -r gen.bin --exit-on-end-session --end-marker "BATCH_DONE"  # ...exit on a custom phrase

      Device Selection:
         When only one USB serial device is connected, it will be automatically selected.
         Use -p option to specify a device when multiple are connected.
         Use -n option to list all available USB serial devices.

      Device Control:
         DTR (Data Terminal Ready): Used by Parallax PropPlug devices
         RTS (Request To Send): Used by some non-Parallax devices

         In standalone mode: Use DTR/RTS toggle buttons in the toolbar
         In IDE mode: VSCode SPIN2 extension controls DTR/RTS via --rts flag
```

These options should already make sense but here's a light-weight recap:

| Option forms                       | Description                                                    |
| ---------------------------------- | -------------------------------------------------------------- |
| <pre>-V, -\-version</pre>          | Shows the PNut Term TS version information                     |
| <pre>-r, -\-ram {fileSpec}</pre>   | Download binary file to RAM and run                            |
| <pre>-f, -\-flash {fileSpec}</pre> | Download binary file to FLASH and run                          |
| <pre>-b, -\-debugbaud {rate}</pre> | **Override** the debug baud rate used for runtime DEBUG communication after download.<br>Normally taken from the binary being downloaded; falls back to 2000000.<br>Precedence: `-b` → the binary's own rate → project settings → user settings → 2000000. |
| <pre>-p, -\-plug {dvcNode}</pre>   | Specify USB serial device (auto-detects if only one connected) |
| <pre>-n, -\-dvcnodes</pre>         | List all available USB serial devices (PropPlug by default)    |
| <pre>-d, -\-debug</pre>            | Enable debug-level messaging                                   |
| <pre>-v, -\-verbose</pre>          | Enable verbose-level messaging                                 |
| <pre>-q, -\-quiet</pre>            | Suppress banner and non-error messages                         |
| <pre>-m, -\-match-vendor-only</pre> | Match any FTDI device (VID 0x0403), ignore product ID<br>Useful for generic FTDI adapters or custom P2 boards |
| <pre>-\-ide</pre>                  | Enable IDE mode for VSCode/IDE integration                     |
| <pre>-\-rts</pre>                  | Use RTS instead of DTR for device reset. Works in standalone mode as well as with `--ide`; overrides the per-device setting. A device first seen while `--rts` is active is *recorded* as RTS. |
| <pre>-u, -\-log-usb-trfc</pre>     | Enable USB traffic logging to timestamped log file             |
| <pre>-\-console-mode</pre>         | Add delay before close when running with console output        |
| <pre>-\-headless</pre>             | Run without GUI windows — file logging only (CI / AI agents)   |
| <pre>-\-timeout {seconds}</pre>    | Exit after N seconds (**headless only**)                       |
| <pre>-\-end-marker [phrase]</pre>  | Exit when phrase appears in output (default: `END_SESSION` or `DEBUG_END_SESSION`).<br>Requires `--headless` or `--exit-on-end-session`. |
| <pre>-\-exit-on-end-session</pre>  | Headed batch mode: exit on the end-session marker, draining in-flight window SAVEs and logs first |
| <pre>-h, -\-help</pre>             | Show the help output above                                     |

### Option constraints

A bad command line stops **before anything runs** and exits with code `2`; option-value and
flag-combination problems are all reported at once.

- `-r` and `-f` are mutually exclusive.
- `--timeout` requires `--headless`.
- `--end-marker` requires `--headless` or `--exit-on-end-session`, and its phrase cannot be empty.
- `--debugbaud` and `--timeout` must be positive whole numbers.
- `-p` matches the device path **or** serial number, case-insensitively, and accepts a partial
  match. If it matches no attached device the run **stops** — it does not fall back to
  auto-detect and silently use a different device.

### Exit codes

| Code | Meaning |
| ---- | ------- |
| `0`  | Normal exit (including a clean end-session marker) |
| `1`  | Port error — enumeration failed, or the requested device was not found |
| `2`  | Usage error — bad command line; nothing was run |
| `3`  | Download failed |
| `124`| Timed out (`--timeout`) |
| `125`| Flush timeout during shutdown |

---

> If you like my work and/or this has helped you in some way then feel free to help me out for a couple of :coffee:'s or :pizza: slices or support my work by contributing at Patreon!
>
> [![coffee](https://www.buymeacoffee.com/assets/img/custom_images/black_img.png)](https://www.buymeacoffee.com/ironsheep) &nbsp;&nbsp; -OR- &nbsp;&nbsp; [![Patreon](./DOCs/images/patreon.png)](https://www.patreon.com/IronSheep?fan_landing=true)[Patreon.com/IronSheep](https://www.patreon.com/IronSheep?fan_landing=true)

---

## License

Licensed under the MIT License.

Follow these links for more information:

### [Copyright](copyright) | [License](LICENSE)

[maintenance-shield]: https://img.shields.io/badge/maintainer-stephen%40ironsheep%2ebiz-blue.svg?style=for-the-badge
[license-shield]: https://img.shields.io/badge/License-MIT-yellow.svg
[Release-shield]: https://img.shields.io/github/release/ironsheep/PNut-Term-TS/all.svg
[Issues-shield]: https://img.shields.io/github/issues/ironsheep/PNut-Term-TS.svg
[node-badge]: https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white
