# Security

This project controls a cellular modem through a local web console. Treat it like an admin panel for a physical device.

## Recommended Deployment

Use it only on a trusted LAN.

Do not expose the console to the public internet.

Start with a console token:

```powershell
$env:CONSOLE_TOKEN='change-this-password'
node .\web\server.js
```

Then enter the token in the local web console.

## Risky Operations

By default, the web console blocks common write commands such as:

```text
AT+QCFG=...
AT+CFUN=...
AT+CGDCONT=...
AT+CGACT=...
AT+CMGD...
AT+CMGS...
```

To intentionally allow dangerous AT commands for experiments:

```powershell
$env:ALLOW_DANGEROUS_AT='1'
node .\web\server.js
```

Do this only on a trusted network and only after recording the current modem state.

## Sensitive Data

The modem may expose:

```text
IMSI
ICCID
SMS contents
APN
carrier registration state
module IP addresses
```

Do not paste logs containing private SIM/eSIM data into public issues unless redacted.

Treat eSIM activation codes as secrets. The download page passes an activation code directly to local `lpac`, redacts it from returned output and does not store it. Do not paste an activation code into a public issue, screenshot or chat.
