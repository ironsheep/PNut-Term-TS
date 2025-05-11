# PNut-Term-TS - Command Line

![Project Maintenance][maintenance-shield]

[![License][license-shield]](LICENSE)

![NodeJS][node-badge]

[![Release][Release-shield]](https://github.com/ironsheep/PNut-Term-TS/releases)

[![GitHub issues][Issues-shield]](https://github.com/ironsheep/PNut-Term-TS/issues)

## Everyday Use of PNut-Term-TS

Our new PNut-Term-TS will show you the following when you specify `-h` or `--help`:

```text
PNut-Term-TS: Usage: pnut-term-ts [optons]

Serial Terminal TS - v0.1.0

Options:
  -V, --version             Output the version number
  -f, --flash               Download to FLASH and run
  -r, --ram                 Download to RAM and run
  -b, --debug(b)aud {rate}  Debug baud rate (default 2000000)
  -p, --plug <dvcNode>      Receive serial data from Propeller attached to <dvcNode>
  -n, --dvcnodes            List available USB PropPlug device (n)odes
  -l, --log <basename>      Specify .log file basename
  -d, --debug               Output term-ts Debug messages
  -v, --verbose             Output term-ts verbose messages
  -q, --quiet               Quiet mode (suppress term-ts banner and non-error text)
  -h, --help                display help for command

      Example:
         $ pnut-term-ts -p P9cektn7           # run using PropPlug on /dev/tty.usbserial-P9cektn7
         $ pnut-term-ts -l myApp -p P9cektn7  # run and log to myApp-YYMMDD-HHmm.log
         
pnut-term-ts: * Propeller Debug Terminal 'pnut-term-ts' (c) 2025 Iron Sheep Productions, LLC., Parallax Inc.
pnut-term-ts: * Version 0.1.0, Build date: 5/11/2025
```

These options should already make sense but here's a light-weight recap:

| Option forms | Description |
| --- | --- |
| <pre>-r, -\-ram</pre> | Download to RAM and run  |
| <pre>-f, -\-flash</pre> | Download to FLASH and run  |
| <pre>-b, -\-debugbaud {rate}</pre> | set Debug baud rate (default 2000000) |
| <pre>-l, -\-log {basename}</pre> | control the generation of the additional (.lst) listing and (.ob) object files |
| <pre>-V, -\-version</pre> | shows the term ts version information |
| <pre>-d, --debug,<br>-q, --quiet,<br>-v, --verbose</pre> | control how little or how much extra messaging is output from Pnut Term TS |


And of course `-h` or `--help` produces the output as shown above.


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
