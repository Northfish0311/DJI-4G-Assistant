# Third-Party Notices

DJI 4G Assistant is MIT licensed. Release packages and optional downloads may contain third-party software under their own licenses.

## lpac and libeuicc

- https://github.com/estkme-group/lpac
- Used for local eUICC profile management.
- The upstream release contains components under multiple licenses. Their texts are preserved in `tools/lpac/LICENSE-*` and copied into packaged resources.

## MaVo and the optional QDC507 voice runtime

- Upstream: https://github.com/moluncn/mavo
- Pinned commit: `0443dfdaf8aec086fd76ba2ee9152fd908114524`
- MaVo's application and transport source are MIT licensed.
- The optional runtime is not bundled in this repository or the Windows EXE. The app downloads six pinned files on demand from the commit above, then verifies the exact byte size and SHA-256 declared in `web/voice-runtime.js`.
- The supplied QDC507 kernel modules include `COPYING-GPL-2.0` and remain under their upstream GPL-2.0 terms. The downloaded directory also preserves the upstream manifest and module report.
- The runtime is limited to kernel `3.18.44` and the verified `QDC507GLEFM21` path. Upstream documentation describes remaining live DSP and non-zero-sample validation boundaries; this project therefore labels the audio path experimental.
- The local ADB USB transport follows Android's public ADB wire protocol and the MIT-licensed MaVo implementation as a technical reference.

## Zadig / libwdi

- https://zadig.akeo.ie/
- https://github.com/pbatard/libwdi
- Used only as an external, user-run option to bind WinUSB to the exact QDC507 ADB child interface.
- Zadig/libwdi is not bundled, downloaded, or launched silently by this project.

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

No source code from DJOneHub, VoHive, NetXD, CellDock, or CardDock is included. Their public feature sets and documentation were reviewed as product references.
