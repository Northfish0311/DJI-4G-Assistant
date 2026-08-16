# Third-Party Notices

DJI RoamDock is MIT licensed. Release packages also contain third-party software under their own licenses.

## lpac and libeuicc

- https://github.com/estkme-group/lpac
- Used for local eUICC profile management.
- The upstream release contains components under multiple licenses. Their texts are preserved in `tools/lpac/LICENSE-*` and copied into packaged resources.

## usb

- https://github.com/node-usb/node-usb
- MIT license.
- Runtime dependencies `node-gyp-build`, `node-addon-api`, and `@types/w3c-web-usb` are also MIT licensed.

## Electron

- https://www.electronjs.org/
- MIT license.
- Used for the Windows desktop package.

## Quectel Windows ECM driver

- Downloaded on demand from Quectel's official website; it is not redistributed in this repository or release package.
- The installer verifies the expected ZIP SHA-256, target hardware ID, driver metadata, Microsoft WHCP catalog signature, and Quectel driver-binary signature before installation.
- The driver remains subject to Quectel's terms.

No source code from DJOneHub, VoHive, or NetXD is included; only their published feature sets were reviewed as product references.
