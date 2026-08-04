# Hardware Safety

The normal launcher is read-only. Keep it that way for ordinary use.

The dedicated original-module setup launcher can make two real modem changes after explicit browser confirmations:

```text
AT+QCFG="usbcfg",...
AT+QCFG="usbnet",1
AT+CFUN=1,1
```

Use it only with a supported untouched `2CA3:4006` module. Do not use it on a working `2C7C:0125` module.

Before any intentional write, record the module's own answers to:

```text
ATI
AT+GMR
AT+QCFG="usbnet"
AT+QCFG="usbcfg"
AT+CPIN?
AT+COPS?
AT+CEREG?
AT+CSQ
AT+QNWINFO
```

Do not delete eSIM profiles or enter carrier credentials through an untrusted network. The project deliberately does not expose profile deletion in its browser UI.
