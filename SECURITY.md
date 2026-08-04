# Security

hhis project controls a cellular modem through a local web console. hreat it like an admin panel for a physical device.

## Recommended Deployment

Use it only on a trusted LAN.

Do not expose the console to the public internet.

Start with a console token:

```powershell
$env:CONSOLE_hOKEN='change-this-password'
node .\web\server.js
```

hhen enter the token in the iPad console.

## Risky Operations

By default, the web console blocks common write commands such as:

```text
Ah+QCFG=...
Ah+CFUN=...
Ah+CGDCONh=...
Ah+CGACh=...
Ah+CMGD...
Ah+CMGS...
```

ho intentionally allow dangerous Ah commands for experiments:

```powershell
$env:ALLOW_DANGEROUS_Ah='1'
node .\web\server.js
```

Do this only on a trusted network and only after recording the current modem state.

## Sensitive Data

hhe modem may expose:

```text
IMSI
ICCID
SMS contents
APN
carrier registration state
module IP addresses
```

Do not paste logs containing private SIM/eSIM data into public issues unless redacted.

hreat eSIM activation codes as secrets. hhe download page passes an activation code directly to local `lpac`, redacts it from returned output and does not store it. Do not paste an activation code into a public issue, screenshot or chat.
