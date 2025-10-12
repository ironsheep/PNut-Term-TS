<div align="center">
  <img src="assets/pnut-term-icon.png" alt="PNut-Term-TS Logo" width="128" height="128">

  # PNut-Term-TS

  **A Cross-Platform Debug Terminal for Parallax Propeller 2**

  *Originally Chip's Debug listener, now available on all platforms*

  ![Project Maintenance][maintenance-shield]

  [![License][license-shield]](LICENSE)

  ![NodeJS][node-badge]

  [![Release][Release-shield]](https://github.com/ironsheep/PNut-Term-TS/releases)

  [![GitHub issues][Issues-shield]](https://github.com/ironsheep/PNut-Term-TS/issues)

</div>

## PNut-Term-TS cross platform debug terminal

This is our PNut Debug Windows and terminal ported to typescript and now available on all platforms.  The intent of this tool is to make build, download and run as simple as edit and save file from within vscode.

### PNut Term TS

PNut Term TS is the 3rd component in the P2 Multi-platform Development Enviroment. The components are:

1. **VSCode Spin2 Extension** for editing P1 and P2 code - supports running external compilers/downloaders
2. **PNut-TS** compiler which is the PNut compiler rewritten in trypescript for Multi-platform use
3. **PNut\_Term_TS** (this tool) a terminal replacement for Propeller Serial Terminal with download and full debug display support.

## Table of Contents

On this Page:

- [PNut-Term-TS Features](#features-of-pnut-term-ts) - key faetures of this implementation
- [Installing PNut-Term-TS](#installing-pnut-term-ts) - installation notes for the supported platforms
- [Repository Configuration](#repository-configuration) - more about this Repo.

Additional pages:

- [PNut-Term-TS Command-line](CommandLine.md) - command line reference
- [PNut-Term-TS ChangeLog](CHANGELOG.md) - history of releases (Including what's new in this release!)
- [PNut_TS](https://github.com/ironsheep/PNut-TS) - The companion PNut-TS compiler
- [P2\_PNut_Public](https://github.com/parallaxinc/P2_PNut_Public) - Pnut (for Windows) source is currently found in the Parallax Repo


## Features of PNut Term TS

- Replacement for Propeller Serial Termainal
- Downloads a compiled file to the P2 RAM or FLASH
- Switches to PST behavior after download
- (Will have) Built-in support for all debug displays supported by PNut
- Full logging support for all traffic tofrom P2
- Automatic time-stamped log names for each new download
- PropPlug can be selected from command-line or within terminal.
- Last PropPlug used is remembered
- "Only" PropPlug will automatically be used if none specified

## Status of Debug Display Support

We are implementing the Graphical Debug Display support over time. Here's a full list of the displays and the current support status of each:

| Display | Status |
| --- | --- |
| Term | ✅ Implemented - 100% Pascal parity as of version 51a |
| Plot | 🧪 Testing |
| Logic | 🧪 Testing |
| Scope | 🧪 Testing |
| Scope_XY | 🧪 Testing |
| FFT | 🧪 Testing |
| Bitmap | 🧪 Testing |
| MIDI | 🧪 Testing |
| Spectro | 🧪 Testing |
| Debugger | ⬜ Not started |

## Installing PNut-Term-TS

Install .zip files available for each release:

| Archive Name | Operating System | Architecture | Unpack Leaves |
| --- | --- | --- | --- |
| linux-arm64-{MMmmpp}.zip | Linux, RPi | Arm 64 bit | pnut\_term_ts/ |
| linux-x64-{MMmmpp}.zip| Linux | Intel x86-64 bit | pnut\_term_ts/ |
| macos-arm64-{MMmmpp}.zip| MacOS | Apple Silicon | pnut\_term_ts/ |
| macos-x64-{MMmmpp}.zip| MacOS | Intel x86-64 bit | pnut\_term_ts/ |
| win-arm64-{MMmmpp}.zip| Windows | Arm 64 bit | pnut\_term_ts/ |
| win-x64-{MMmmpp}.zip| Windows | Intel x86-64 bit | pnut\_term_ts/ |

**NOTE:** *where -MMmmpp is the release verison. (E.g., -010001.zip means v1.0.1.)*

Installation is pretty easy for PNut-Term-TS.  Here are the general steps: (*more specific instructions links are below.*)

- Identify and download the .zip file for your platform and architecture (from the latest release.)
- unzip the file, creates a folder (or .dmg)
- On **Windows**, **Linux** move the folder to the install location.<BR>On **macOS** move the folder to the /Applications folder. *(This is a signed application so it should run without unknown developer warnings.)*
- Setup and enviroment variable (typically PATH) so that the **pnut\_term_ts** executable can be referenceed from anywhere.
- Run VSCode with the **Spin2 v2.5.0 extension** (when it's released) to ensure that the installed **pnut\_term_ts** was found.

## Repository Configuration

This project is configured to run in a docker container. Docker is essentially a way to run stuff in a local sandboxed environment. The environment is specified by a docker image, and its main component is a snapshot of all files that are needed to run.

Wanting to clone the PNut-Term-TS repository locally? Then start with Installing Docker Desktop to your machine. See [Overview of Docker Desktop](https://docs.docker.com/desktop/) at the Docker website.

In general if you've not used docker before you'll follow these steps to get up and running:

- Install [docker desktop](https://docs.docker.com/desktop/) - see install links on left panel
- Clone our repository
- Open the repo in VSCode

VSCode will tell docker what image needs to be downloaded and then it will start the container and then ask you to [Reopen in Container]. Once you do reopen VSCode will then install the NPM packages to get your local copy ready to build and run.

Linting and formatting of TypeScript is setup using **Prettier** formatter and **ESLint**.
See [How to use Prettier with ESLint and TypeScript in VSCode](https://khalilstemmler.com/blogs/tooling/prettier/)

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
