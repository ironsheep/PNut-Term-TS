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

PNut Terminal TS - v0.5.0

Options:
  -V, --version             Output the version number
  -f, --flash <fileSpec>    Download to FLASH and run
  -r, --ram <fileSpec>      Download to RAM and run
  -b, --debug(b)aud {rate}  set debug baud rate (default 2000000)
  -p, --plug <dvcNode>      Receive serial data from Propeller attached to <dvcNode> (auto-detects if only one USB serial device)
  -n, --dvcnodes            List available USB PropPlug device (n)odes
  -d, --debug               Output Term-TS Debug messages
  -v, --verbose             Output Term-TS Verbose messages
  -q, --quiet               Quiet mode (suppress Term-TS banner and non-error text)
  --ide                     IDE mode - minimal UI for VSCode/IDE integration
  --rts                     Use RTS instead of DTR for device reset (requires --ide)
  -u, --log-usb-trfc        Enable USB traffic logging (timestamped log file)
  --console-mode            Running with console output - adds delay before close
  -h, --help                display help for command

      Examples:
         $ pnut-term-ts                                          # auto-detects and uses USB serial device (if only one connected)
         $ pnut-term-ts -p P9cektn7                              # run using PropPlug on /dev/tty.usbserial-P9cektn7
         $ pnut-term-ts -r myTopfile.bin                         # download to RAM (auto-detects single USB device)
         $ pnut-term-ts -r myTopfile.bin -p P9cektn7             # download myTopfile.bin to RAM and run
         $ pnut-term-ts --ide                                    # IDE mode (auto-detects single USB device)
         $ pnut-term-ts --ide -p P9cektn7                        # IDE mode for VSCode integration
         $ pnut-term-ts --ide --rts -p P9cektn7                  # IDE mode using RTS instead of DTR for device reset
         $ pnut-term-ts -u -p P9cektn7                           # Enable USB traffic logging (timestamped log file)

      Device Selection:
         When only one USB serial device is connected, it will be automatically selected.
         Use -p option to specify a device when multiple are connected.
         Use -n option to list all available USB serial devices.

      Device Control:
         DTR (Data Terminal Ready): Used by Parallax PropPlug devices
         RTS (Request To Send): Used by some non-Parallax devices

         In standalone mode: Use DTR/RTS toggle buttons in the toolbar
         In IDE mode: VSCode SPIN2 extension controls DTR/RTS via --rts flag

pnut-term-ts: * Propeller Debug Terminal 'pnut-term-ts' (c) 2025 Iron Sheep Productions, LLC., Parallax Inc.
pnut-term-ts: * Version 0.5.0, {buildDateHere}
```

These options should already make sense but here's a light-weight recap:

| Option forms | Description |
| --- | --- |
| <pre>-V, -\-version</pre> | Shows the PNut Term TS version information |
| <pre>-r, -\-ram {fileSpec}</pre> | Download binary file to RAM and run |
| <pre>-f, -\-flash {fileSpec}</pre> | Download binary file to FLASH and run |
| <pre>-b, -\-debugbaud {rate}</pre> | Set debug baud rate (default 2000000) |
| <pre>-p, -\-plug {dvcNode}</pre> | Specify USB serial device (auto-detects if only one connected) |
| <pre>-n, -\-dvcnodes</pre> | List all available USB PropPlug devices |
| <pre>-d, -\-debug</pre> | Enable debug-level messaging |
| <pre>-v, -\-verbose</pre> | Enable verbose-level messaging |
| <pre>-q, -\-quiet</pre> | Suppress banner and non-error messages |
| <pre>-\-ide</pre> | Enable IDE mode for VSCode/IDE integration |
| <pre>-\-rts</pre> | Use RTS instead of DTR for device reset (requires --ide) |
| <pre>-u, -\-log-usb-trfc</pre> | Enable USB traffic logging to timestamped log file |
| <pre>-\-console-mode</pre> | Add delay before close when running with console output |

And of course `-h` or `--help` produces the full help output as shown above.


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
