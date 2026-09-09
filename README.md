# pxt-wifi

A MakeCode extension for the **Calliope mini** that drives the **Calliope WiFi Module** (ESP32 AT-firmware based). Supports sending data to **ThingSpeak**, **IFTTT**, and **Adafruit IO**, as well as sending raw TCP/UDP messages.

## Hardware

- [Calliope mini](https://calliope.cc/)
- [Grove - UART WiFi V2 (ESP32)](https://wiki.seeedstudio.com/Grove-UART_Wifi_V2/)

Default wiring:

| Module | Calliope mini pin |
|--------|-------------------|
| TX     | C16               |
| RX     | C17               |

## Blocks

### Setup WiFi

Connect to a WiFi network. Call this once at startup.

```blocks
WiFi.setupWifi(
    SerialPin.C17, SerialPin.C16,
    BaudRate.BaudRate115200,
    "MySSID", "MyPassword"
)
```

### Check connection

```blocks
if (WiFi.wifiOK()) {
    basic.showString("OK")
}
```

### Send to ThingSpeak

```blocks
WiFi.sendToThinkSpeak("YOUR_WRITE_API_KEY", 23.5)
```

### Send to IFTTT

```blocks
WiFi.sendToIFTTT("my_event", "YOUR_KEY", "Hello", "Calliope", "mini")
```

### Adafruit IO – POST a value

```blocks
WiFi.adafruitIOPost("username", "feed-name", "42", "YOUR_AIO_KEY")
```

### Adafruit IO – GET the latest value

```typescript
let val = WiFi.adafruitIOGetValue("feed-name", "username", "YOUR_AIO_KEY")
basic.showString(val)
```

### Send a raw TCP / UDP message

```blocks
WiFi.sendMessage(MessageType.TCP, "192.168.1.10", 1234, "hello")
```

## License

MIT

## Supported targets

* [Calliope mini](https://calliope.cc/) (`calliope`)
