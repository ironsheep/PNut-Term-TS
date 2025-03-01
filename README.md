# PNut-Term-TS

A recreation of Chips' Debug listener but multiplatform

![Project Maintenance][maintenance-shield]

[![License][license-shield]](LICENSE)

![NodeJS][node-badge]

[![Release][Release-shield]](https://github.com/ironsheep/PNut-Term-TS/releases)

[![GitHub issues][Issues-shield]](https://github.com/ironsheep/PNut-Term-TS/issues)

## PNut-Term-TS cross platform debug terminal

This is our PNut Debug Windows and terminal ported to typescript and now available on all platforms.  The intent of this tool is to make build, download and run as simple as edit and save file from within vscode.

### PNut Term TS

PNut Term TS is the 3rd component in the P2 Multi-platform Development Enviroment. The components are:

1. **VSCode Spin2 Extension** for editing P1 and P2 code - supports running external compilers/downloaders
2. **PNut_TS** compiler which is the PNut compiler rewritten in trypescript for Multi-platform use
3. **PNut\_Term_TS** (this tool) a terminal replacement for Propeller Serial Terminal with download and full debug display support.

### Features of PNut Term TS

- Replacement for Propeller Serial Termainal
- Downloads a compiled file to the P2 RAM or FLASH
- Download from command-line enables file watcher which redownloads on file change
- Switches to PST behavior after download
- Has Built-in support for all debug displays supported by PNut
- Full logging support for all traffic tofrom P2
- Automatic time-stamped log names for each new download
- Filewatcher for automatic downloads can be disabled
- Has the concept of last file download making re-download a simple button-press
- PropPlug can be selected from command-line or within terminal.
- Last PropPlug used is remembered
- "Only" PropPlug will automatically be used if none specified
- [Enable]/[Disable] releases USB port for use by other tools

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
